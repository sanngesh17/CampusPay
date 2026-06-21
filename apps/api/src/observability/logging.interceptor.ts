import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

/** Logs method, path, status and latency for every request (via the RedactingLogger, so no PII leaks). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - startedAt}ms`),
        error: (err: { status?: number }) =>
          this.logger.warn(
            `${req.method} ${req.url} ${err?.status ?? 500} ${Date.now() - startedAt}ms`,
          ),
      }),
    );
  }
}
