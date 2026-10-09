import { S3StorageService } from './s3-storage.service.js';
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

const URL = 'https://files.example.com/track-audio/track-1/processing-1.wav';

describe('S3StorageService.downloadPublicObject', () => {
  const send = vi.fn();
  const fetchMock = vi.fn<typeof fetch>();
  let service: S3StorageService;

  beforeEach(() => {
    send.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    service = new S3StorageService({ send, destroy: vi.fn() }, config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the bytes of the object from its public URL, without a storage request', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([82, 73, 70, 70])));

    const bytes = await service.downloadPublicObject(URL);

    expect(fetchMock).toHaveBeenCalledWith(URL, expect.anything());
    expect(bytes).toEqual(new Uint8Array([82, 73, 70, 70]));
    expect(send).not.toHaveBeenCalled();
  });

  it('fails with a StorageError when the URL answers an error status', async () => {
    fetchMock.mockResolvedValue(new Response('missing', { status: 404 }));

    await expect(service.downloadPublicObject(URL)).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it('fails with a StorageError when the request does not complete', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.downloadPublicObject(URL)).rejects.toThrow(
      `Could not download ${URL}`,
    );
  });
});
