import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { downloadLrclibDump, fetchLatestDumpKey } from './lrclib-download.js';

const withServer = async (
  routes: Map<string, { status: number; body: Buffer | string }>,
  work: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const server = createServer((request, response) => {
    const route = routes.get(request.url ?? '/');
    if (route === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not Found');
      return;
    }
    response.writeHead(route.status, {
      'content-type': 'application/octet-stream',
    });
    response.end(route.body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    await work(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
};

describe('fetchLatestDumpKey', () => {
  it('picks the newest dump of the listing', async () => {
    const body = JSON.stringify({
      objects: [
        { key: 'lrclib-db-dump-20260410T042405Z.sqlite3.gz' },
        { key: 'lrclib-db-dump-20260923T042405Z.sqlite3.gz' },
      ],
      truncated: false,
    });

    await withServer(
      new Map([['/listing', { status: 200, body }]]),
      async (baseUrl) => {
        await expect(fetchLatestDumpKey(`${baseUrl}/listing`)).resolves.toBe(
          'lrclib-db-dump-20260923T042405Z.sqlite3.gz',
        );
      },
    );
  });

  it('fails with a clear error on an empty listing or a bad status', async () => {
    await withServer(
      new Map([
        ['/empty', { status: 200, body: '{"objects":[]}' }],
        ['/missing', { status: 404, body: 'Not Found' }],
      ]),
      async (baseUrl) => {
        await expect(fetchLatestDumpKey(`${baseUrl}/empty`)).rejects.toThrow(
          'holds no dumps',
        );
        await expect(fetchLatestDumpKey(`${baseUrl}/missing`)).rejects.toThrow(
          'failed with HTTP 404',
        );
      },
    );
  });
});

describe('downloadLrclibDump', () => {
  it('streams the download gunzipped straight to its file, keeping no .gz', async () => {
    const sqliteBytes = Buffer.from('SQLite format 3\0tiny dump');

    await withServer(
      new Map([['/files/key', { status: 200, body: gzipSync(sqliteBytes) }]]),
      async (baseUrl) => {
        const dir = mkdtempSync(join(tmpdir(), 'lrclib-download-'));
        const downloaded = await downloadLrclibDump({
          baseUrl: `${baseUrl}/files`,
          key: 'key',
          dir,
        });

        expect(downloaded.key).toBe('key');
        expect(readFileSync(downloaded.path)).toEqual(sqliteBytes);
        expect(readdirSync(dir).some((file) => file.endsWith('.gz'))).toBe(
          false,
        );
      },
    );
  });

  it('fails with a clear error when the file is missing', async () => {
    await withServer(new Map(), async (baseUrl) => {
      await expect(
        downloadLrclibDump({ baseUrl, key: 'nope.sqlite3.gz' }),
      ).rejects.toThrow('failed with HTTP 404');
    });
  });
});
