import { createHash } from 'node:crypto';

export interface AppConfig {
  readonly encryptionKey: Buffer;
  readonly hmacSecret: string;
  readonly xrplEnabled: boolean;
  readonly xrplWss: string;
  readonly xrplIssuerSeed?: string;
  readonly railConfigPath?: string;
  readonly tcsConfigPath?: string;
  readonly persistence: 'memory' | 'prisma';
  readonly storage: 'local' | 's3';
  readonly localStorageRoot?: string;
  readonly s3Endpoint?: string;
  readonly s3Region?: string;
  readonly s3Bucket?: string;
  readonly s3AccessKeyId?: string;
  readonly s3SecretAccessKey?: string;
  readonly s3ForcePathStyle: boolean;
}

function resolveEncryptionKey(env: NodeJS.ProcessEnv): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (raw && raw.trim().length > 0) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must decode to 32 bytes (base64-encoded)');
    }
    return key;
  }
  // Dev/test fallback: a deterministic 32-byte key. NEVER use this in production.
  return createHash('sha256').update('tuitionflow-dev-only-key').digest();
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const storage = env.PRIVATE_STORAGE === 's3' ? 's3' : 'local';
  if (
    storage === 's3' &&
    (!env.S3_REGION || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
  )
    throw new Error(
      'S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for S3 private storage',
    );
  return {
    encryptionKey: resolveEncryptionKey(env),
    hmacSecret: env.PARTNER_WEBHOOK_HMAC_SECRET ?? 'dev-hmac-secret',
    xrplEnabled: env.XRPL_ENABLED === 'true',
    xrplWss: env.XRPL_WSS ?? 'wss://s.altnet.rippletest.net:51233',
    ...(env.XRPL_ISSUER_SEED ? { xrplIssuerSeed: env.XRPL_ISSUER_SEED } : {}),
    ...(env.RAIL_CONFIG_PATH ? { railConfigPath: env.RAIL_CONFIG_PATH } : {}),
    ...(env.TCS_CONFIG_PATH ? { tcsConfigPath: env.TCS_CONFIG_PATH } : {}),
    persistence: env.PERSISTENCE === 'prisma' ? 'prisma' : 'memory',
    storage,
    ...(env.LOCAL_STORAGE_ROOT ? { localStorageRoot: env.LOCAL_STORAGE_ROOT } : {}),
    ...(env.S3_ENDPOINT ? { s3Endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_REGION ? { s3Region: env.S3_REGION } : {}),
    ...(env.S3_BUCKET ? { s3Bucket: env.S3_BUCKET } : {}),
    ...(env.S3_ACCESS_KEY_ID ? { s3AccessKeyId: env.S3_ACCESS_KEY_ID } : {}),
    ...(env.S3_SECRET_ACCESS_KEY ? { s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY } : {}),
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  };
}
