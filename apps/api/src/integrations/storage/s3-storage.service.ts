import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  type PublicObject,
  StorageError,
  StorageService,
} from './storage.service.js';
import type { StorageConfig } from './storage-config.js';

// Without a deadline, a storage server that stops answering would hold a
// request open indefinitely.
const REQUEST_TIMEOUT_MS = 15_000;

/** The part of the SDK client used here, so tests can pass a fake. */
type S3Sender = Pick<S3Client, 'send' | 'destroy'>;

/** A HEAD of a missing key fails with the SDK's `NotFound`. */
const isNotFound = (error: unknown): boolean =>
  error instanceof Error && error.name === 'NotFound';

export const createS3Client = (config: StorageConfig): S3Client =>
  new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

/**
 * `StorageService` on any S3 API: AWS S3 in production, MinIO locally and in
 * the e2e tests. The only class that touches the AWS SDK.
 */
export class S3StorageService
  extends StorageService
  implements OnModuleDestroy
{
  constructor(
    private readonly client: S3Sender,
    private readonly config: Pick<StorageConfig, 'bucket' | 'publicUrl'>,
  ) {
    super();
  }

  async putPublicObject({
    key,
    body,
    contentType,
  }: PublicObject): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ACL: 'public-read',
        }),
        { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
    } catch (error) {
      throw new StorageError(`Could not store "${key}"`, { cause: error });
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw new StorageError(`Could not check "${key}"`, { cause: error });
    }
  }

  publicUrl(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${this.config.publicUrl}/${path}`;
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
