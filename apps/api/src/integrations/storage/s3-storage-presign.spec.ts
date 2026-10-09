import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  createS3Client,
  createUrlPresigner,
  S3StorageService,
  type UrlPresigner,
} from './s3-storage.service.js';
import { StorageError } from './storage.service.js';

const config = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'notefinder',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  forcePathStyle: true,
  publicUrl: 'https://files.example.com',
};

const put = {
  key: 'track-vocals/track-1/processing-1.wav',
  contentType: 'audio/wav',
  expiresInSeconds: 7_200,
};

describe('S3StorageService.presignPublicPut', () => {
  const send = vi.fn();
  const destroy = vi.fn();

  beforeEach(() => {
    send.mockReset();
    destroy.mockReset();
  });

  it('signs a PUT of the key with its content type, for the lifetime asked', async () => {
    const presigner = vi
      .fn<UrlPresigner>()
      .mockResolvedValue('https://signed.test/vocals');
    const service = new S3StorageService({ send, destroy }, config, presigner);

    await expect(service.presignPublicPut(put)).resolves.toBe(
      'https://signed.test/vocals',
    );

    const call = presigner.mock.calls[0];
    expect(call?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(call?.[0]?.input).toEqual({
      Bucket: 'notefinder',
      Key: put.key,
      ContentType: 'audio/wav',
    });
    expect(call?.[1]).toBe(7_200);
  });

  it('sends no request to sign a URL', async () => {
    const presigner = vi.fn<UrlPresigner>().mockResolvedValue('https://x.test');
    const service = new S3StorageService({ send, destroy }, config, presigner);

    await service.presignPublicPut(put);

    expect(send).not.toHaveBeenCalled();
  });

  it('refuses to sign without a presigner, as a StorageError', async () => {
    const service = new S3StorageService({ send, destroy }, config);

    await expect(service.presignPublicPut(put)).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it('reports a signing failure as a StorageError with the cause', async () => {
    const cause = new Error('bad credentials');
    const presigner = vi.fn<UrlPresigner>().mockRejectedValue(cause);
    const service = new S3StorageService({ send, destroy }, config, presigner);

    const failure = service.presignPublicPut(put);

    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({ cause });
  });

  it('signs with the SDK presigner: the URL names the bucket, the key and the lifetime', async () => {
    const client = createS3Client(config);
    const service = new S3StorageService(
      client,
      config,
      createUrlPresigner(client),
    );

    const url = new URL(await service.presignPublicPut(put));

    expect(url.origin).toBe('http://localhost:9000');
    expect(url.pathname).toBe(`/notefinder/${put.key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('7200');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    client.destroy();
  });
});
