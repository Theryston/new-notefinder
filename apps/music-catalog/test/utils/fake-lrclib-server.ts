import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import {
  type FakeDumpRecording,
  writeFakeLrclibDump,
} from '../../src/integrations/lrclib/fake-lrclib-dump.js';

export type FakeLrclibServer = {
  /** The value for `LRCLIB_LISTING_URL`. */
  listingUrl: string;
  /** The value for `LRCLIB_BASE_URL` (the key is appended to it). */
  baseUrl: string;
  /** Every path requested since the server started, in order. */
  requested: string[];
  close: () => Promise<void>;
};

/**
 * Builds a tiny `.sqlite3.gz` in the real LRCLIB schema from the given
 * Recordings, with the same generator the sample mode uses, so the download
 * path serves what the import matches.
 */
export const fakeLrclibDumpGz = (
  recordings: readonly FakeDumpRecording[],
): Buffer => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-lrclib-e2e-'));
  try {
    const path = join(dir, 'lrclib.sqlite3');
    writeFakeLrclibDump(path, recordings);
    return gzipSync(readFileSync(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** A tiny dump whose schema drifted: the importer must refuse it loudly. */
export const schemaMismatchDumpGz = (): Buffer => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-lrclib-bad-'));
  try {
    const path = join(dir, 'lrclib.sqlite3');
    const db = new DatabaseSync(path);
    try {
      db.exec(
        'CREATE TABLE tracks (id INTEGER, name TEXT); CREATE TABLE lyrics (id INTEGER)',
      );
    } finally {
      db.close();
    }
    return gzipSync(readFileSync(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Serves LRCLIB dumps the way the real hosts do: the listing JSON at one URL
 * and the `.sqlite3.gz` files under another. Anything else answers 404, the
 * way a wrong base URL would.
 */
export const startFakeLrclibServer = async (
  dumps: Record<string, Buffer>,
): Promise<FakeLrclibServer> => {
  const keys = Object.keys(dumps).sort();
  const requested: string[] = [];
  const server: Server = createServer((request, response) => {
    const path = request.url ?? '/';
    requested.push(path);
    if (path === '/listing') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          objects: keys.map((key) => ({ key })),
          truncated: false,
        }),
      );
      return;
    }
    const file = path.startsWith('/files/')
      ? dumps[path.slice('/files/'.length)]
      : undefined;
    if (file !== undefined) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(file);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not Found');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The fake LRCLIB server has no port');
  }
  const base = `http://127.0.0.1:${address.port}`;
  return {
    listingUrl: `${base}/listing`,
    baseUrl: `${base}/files`,
    requested,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
};
