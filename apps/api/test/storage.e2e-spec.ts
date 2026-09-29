import { randomUUID } from 'node:crypto';
import {
  StorageError,
  StorageService,
} from '../src/integrations/storage/storage.service.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64',
);

const fetchObject = async (url: string) => {
  const response = await fetch(url);
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body: Buffer.from(await response.arrayBuffer()),
  };
};

describe('Storage (e2e)', () => {
  let testApp: TestApp;
  let storage: StorageService;

  beforeAll(async () => {
    testApp = await createTestApp();
    storage = testApp.app.get(StorageService);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('serves a stored object from its public URL, without credentials', async () => {
    const key = `e2e/${randomUUID()}.png`;

    await storage.putPublicObject({
      key,
      body: PNG,
      contentType: 'image/png',
    });

    expect(await fetchObject(storage.publicUrl(key))).toEqual({
      status: 200,
      contentType: 'image/png',
      body: PNG,
    });
  });

  it('overwrites the object stored under the same key', async () => {
    const key = `e2e/${randomUUID()}.txt`;
    const put = (text: string) =>
      storage.putPublicObject({
        key,
        body: Buffer.from(text),
        contentType: 'text/plain',
      });

    await put('first');
    await put('second');

    const stored = await fetchObject(storage.publicUrl(key));
    expect(stored.body.toString()).toBe('second');
  });

  it('serves keys that need URL encoding from the URL it builds', async () => {
    const key = `e2e/${randomUUID()}/a b#c?d%e ção.txt`;

    await storage.putPublicObject({
      key,
      body: Buffer.from('encoded'),
      contentType: 'text/plain',
    });

    const stored = await fetchObject(storage.publicUrl(key));
    expect(stored.status).toBe(200);
    expect(stored.body.toString()).toBe('encoded');
  });

  it('has nothing at a key that was never stored', async () => {
    const { status } = await fetchObject(
      storage.publicUrl(`e2e/${randomUUID()}.png`),
    );
    expect(status).toBe(404);
  });

  it('fails with a StorageError when the bucket does not exist', async () => {
    const missing = await createTestApp({
      env: { S3_BUCKET: 'notefinder-missing-bucket' },
    });
    try {
      await expect(
        missing.app.get(StorageService).putPublicObject({
          key: 'e2e/any.png',
          body: PNG,
          contentType: 'image/png',
        }),
      ).rejects.toBeInstanceOf(StorageError);
    } finally {
      await missing.close();
    }
  });

  it('refuses to boot without the S3 settings', async () => {
    await expect(
      createTestApp({
        env: {
          S3_ENDPOINT: undefined,
          S3_REGION: undefined,
          S3_BUCKET: undefined,
          S3_ACCESS_KEY_ID: undefined,
          S3_SECRET_ACCESS_KEY: undefined,
          S3_FORCE_PATH_STYLE: undefined,
          S3_PUBLIC_URL: undefined,
        },
      }),
    ).rejects.toThrowError(/File storage is not configured/);
  });
});
