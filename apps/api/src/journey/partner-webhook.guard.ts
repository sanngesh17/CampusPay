import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../tokens';

@Injectable()
export class PartnerWebhookGuard implements CanActivate {
  private readonly nonces = new Map<string, number>();
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; rawBody?: Buffer }>();
    const timestamp = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];
    const signature = request.headers['x-signature'];
    if (!timestamp || !nonce || !signature)
      throw new UnauthorizedException('Signed webhook headers are required');
    const issuedAt = Number(timestamp) * 1000;
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60_000)
      throw new UnauthorizedException('Webhook timestamp is outside the allowed window');
    this.prune();
    if (this.nonces.has(nonce)) throw new ConflictException('Webhook nonce has already been used');
    const expected = createHmac('sha256', this.config.hmacSecret)
      .update(`${timestamp}.${nonce}.`)
      .update(request.rawBody ?? Buffer.alloc(0))
      .digest('hex');
    const providedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    )
      throw new UnauthorizedException('Invalid webhook signature');
    this.nonces.set(nonce, Date.now());
    return true;
  }
  private prune(): void {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [nonce, seenAt] of this.nonces) if (seenAt < cutoff) this.nonces.delete(nonce);
  }
}
