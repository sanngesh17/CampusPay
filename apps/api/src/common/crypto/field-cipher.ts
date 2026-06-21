import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Application-layer field encryption (AES-256-GCM, authenticated). Sensitive PII
 * (pan/passport/bankAccount) is encrypted here before it ever reaches persistence — the database
 * only ever sees ciphertext. Format: `v1:<iv>:<tag>:<ciphertext>` (all base64).
 */
export class FieldCipher {
  private static readonly VERSION = 'v1';

  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error('FieldCipher key must be exactly 32 bytes');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      FieldCipher.VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(blob: string): string {
    const [version, ivB64, tagB64, dataB64] = blob.split(':');
    if (version !== FieldCipher.VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
      throw new Error('FieldCipher: malformed ciphertext');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** True if the value is already in this cipher's envelope format. */
  static isCiphertext(value: string): boolean {
    return value.startsWith(`${FieldCipher.VERSION}:`);
  }
}
