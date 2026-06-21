import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../tokens';

interface RawRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

/** Verifies the partner webhook HMAC (sha256 over the raw body) in constant time. */
@Injectable()
export class HmacGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawRequest>();
    const provided = req.headers['x-signature'];
    const raw = req.rawBody ?? Buffer.alloc(0);

    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    const expected = createHmac('sha256', this.config.hmacSecret).update(raw).digest('hex');
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return true;
  }
}
