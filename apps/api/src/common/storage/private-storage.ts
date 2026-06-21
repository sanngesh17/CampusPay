import {
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import type { AppConfig } from '../../config/app-config';

export interface PrivateStorage {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  health(): Promise<void>;
}

export class LocalPrivateStorage implements PrivateStorage {
  constructor(private readonly root: string) {}

  async put(key: string, value: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, value, 'utf8');
  }
  async get(key: string): Promise<string> {
    return readFile(this.pathFor(key), 'utf8');
  }
  async delete(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch(() => undefined);
  }
  async health(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root);
  }

  private pathFor(key: string): string {
    if (isAbsolute(key)) return key;
    const safe = normalize(key).replace(/^([/\\])+/, '');
    const path = resolve(this.root, safe);
    const root = resolve(this.root);
    if (path !== root && !path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`))
      throw new Error('Invalid private-storage key');
    return path;
  }
}

export class S3PrivateStorage implements PrivateStorage {
  private readonly client: S3Client;
  constructor(private readonly config: AppConfig) {
    this.client = new S3Client({
      region: config.s3Region!,
      endpoint: config.s3Endpoint,
      forcePathStyle: config.s3ForcePathStyle,
      credentials: {
        accessKeyId: config.s3AccessKeyId!,
        secretAccessKey: config.s3SecretAccessKey!,
      },
    });
  }
  async put(key: string, value: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        Body: value,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      }),
    );
  }
  async get(key: string): Promise<string> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.s3Bucket, Key: key }),
    );
    if (!result.Body) throw new Error('Private object has no content');
    return result.Body.transformToString();
  }
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.s3Bucket, Key: key }));
  }
  async health(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.s3Bucket }));
  }
}

export function createPrivateStorage(config: AppConfig): PrivateStorage {
  return config.storage === 's3'
    ? new S3PrivateStorage(config)
    : new LocalPrivateStorage(config.localStorageRoot ?? join(process.cwd(), '.data', 'private'));
}
