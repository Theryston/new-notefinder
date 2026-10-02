import { createServer, type Server } from 'node:http';

export type FakeDumpServer = {
  /** The value for `MUSICBRAINZ_DUMP_BASE_URL` (the `.../data` directory). */
  url: string;
  /** Every path requested since the last reset, in order. */
  requested: string[];
  forgetRequests: () => void;
  close: () => Promise<void>;
};

const FULL_RUN = '20240102-000003';

// A tiny stand-in for a dump archive: the e2e mbslave is faked behind its
// boundary (it downloads these bytes and seeds what the dump would load),
// while `LATEST` and the directory layout are the real MusicBrainz ones.
const tinyArchive = Buffer.from('fake MusicBrainz dump archive, not parsed');

const routes = new Map<string, { status: number; body: Buffer | string }>([
  ['/data/fullexport/LATEST', { status: 200, body: `${FULL_RUN}\n` }],
  [
    `/data/fullexport/${FULL_RUN}/mbdump.tar.bz2`,
    { status: 200, body: tinyArchive },
  ],
  [
    `/data/fullexport/${FULL_RUN}/mbdump-derived.tar.bz2`,
    { status: 200, body: tinyArchive },
  ],
]);

/**
 * Serves tiny dump archives under the real MusicBrainz full-export layout
 * (one `LATEST` file plus the core and derived archives), so the restore
 * resolves and downloads its archives over real HTTP without touching the
 * network. Anything else answers 404, the way a wrong base URL would. The
 * `tiny` dataset needs no server: it is seeded locally and downloads
 * nothing.
 */
export const startFakeDumpServer = async (): Promise<FakeDumpServer> => {
  const requested: string[] = [];
  const server: Server = createServer((request, response) => {
    const path = request.url ?? '/';
    requested.push(path);
    const route = routes.get(path);
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
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The fake dump server has no port');
  }
  return {
    url: `http://127.0.0.1:${address.port}/data`,
    requested,
    forgetRequests: () => {
      requested.length = 0;
    },
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
