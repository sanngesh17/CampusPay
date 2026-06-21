import { ConsoleLogger } from '@nestjs/common';

/** Patterns that must never appear in logs (PII / secrets). */
const REDACTIONS: ReadonlyArray<RegExp> = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // emails
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, // Indian PAN
  /\b[A-PR-WY][1-9]\d\s?\d{4}[1-9]\b/g, // passport-ish
  /\b(s|sn|sEd)[A-Za-z0-9]{20,}\b/g, // XRPL seeds (sXXXX / sEdXXXX)
  /((?:seed|secret|password|token|key|authorization)\s*[=:]\s*)\S+/gi,
];

export function redactSecrets(input: unknown): string {
  let text = typeof input === 'string' ? input : safeStringify(input);
  for (const pattern of REDACTIONS) {
    text = text.replace(pattern, (_match, prefix?: string) =>
      typeof prefix === 'string' ? `${prefix}[REDACTED]` : '[REDACTED]',
    );
  }
  return text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Nest logger that strips PII/secrets from every message before it is written. Defence-in-depth so
 * an accidental `logger.log(student)` can never leak an email, PAN, or wallet seed.
 */
export class RedactingLogger extends ConsoleLogger {
  override log(message: unknown, ...rest: unknown[]): void {
    super.log(redactSecrets(message), ...rest);
  }
  override error(message: unknown, ...rest: unknown[]): void {
    super.error(redactSecrets(message), ...rest);
  }
  override warn(message: unknown, ...rest: unknown[]): void {
    super.warn(redactSecrets(message), ...rest);
  }
  override debug(message: unknown, ...rest: unknown[]): void {
    super.debug(redactSecrets(message), ...rest);
  }
  override verbose(message: unknown, ...rest: unknown[]): void {
    super.verbose(redactSecrets(message), ...rest);
  }
}
