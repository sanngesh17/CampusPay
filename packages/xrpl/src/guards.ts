import { PiiOnChainBlocked } from './errors';

/** A lowercase/uppercase 64-char hex sha256 digest — the ONLY shape allowed on-chain. */
export const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function isHash(value: string): boolean {
  return typeof value === 'string' && SHA256_HEX.test(value);
}

/**
 * The critical rule (build guide §7.2), enforced in code: only a sha256 hash may be written
 * on-chain. Anything else is treated as potential PII and rejected before it can leave the process.
 */
export function assertIsHash(value: string): void {
  if (!isHash(value)) {
    throw new PiiOnChainBlocked(value);
  }
}
