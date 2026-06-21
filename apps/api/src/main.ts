import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RedactingLogger } from './common/logging/redacting-logger';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new RedactingLogger(),
  });
  const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
    );
    next();
  });
  const requestBuckets = new Map<string, { count: number; resetAt: number }>();
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!request.path.startsWith('/api/')) return next();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const existing = requestBuckets.get(key);
    const bucket =
      !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : existing;
    bucket.count += 1;
    requestBuckets.set(key, bucket);
    response.setHeader('RateLimit-Limit', '180');
    response.setHeader('RateLimit-Remaining', Math.max(0, 180 - bucket.count).toString());
    if (bucket.count > 180) return response.status(429).json({ message: 'Too many requests' });
    return next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
