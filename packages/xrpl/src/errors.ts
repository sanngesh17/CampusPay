export class XrplError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'XRPL_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when something other than a sha256 hash is about to be written on-chain.
 * The offending value is NEVER echoed (it may be PII) — only its length is reported.
 */
export class PiiOnChainBlocked extends XrplError {
  constructor(offending?: string) {
    const shape = typeof offending === 'string' ? ` (got ${offending.length} chars)` : '';
    super(`Refusing to write non-hash data on-chain${shape}`, 'PII_ON_CHAIN_BLOCKED');
  }
}

export class NotConnectedError extends XrplError {
  constructor() {
    super('XRPL client is not connected — call connect() first', 'NOT_CONNECTED');
  }
}

export class BatchUnsupportedError extends XrplError {
  constructor(detail: string) {
    super(`Batch submission unsupported on this network/SDK: ${detail}`, 'BATCH_UNSUPPORTED');
  }
}
