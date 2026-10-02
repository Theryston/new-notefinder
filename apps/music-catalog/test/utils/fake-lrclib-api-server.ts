import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LrclibApiTrack } from '../../src/integrations/lrclib/lrclib-api.js';

export type FakeLrclibApiServer = {
  /** The value for `LRCLIB_API_BASE_URL`. */
  baseUrl: string;
  /** Every User-Agent header received, in order. */
  userAgents: string[];
  /** How many API requests arrived since the server started. */
  requests: number;
  close: () => Promise<void>;
};

/**
 * Serves one LRCLIB track per query the way the public API does: the track
 * whose title and artist match (case-insensitively), 404 otherwise. A query
 * listed in `failures` answers 500 instead, the way an overloaded upstream
 * would. Anything the client sends (the duration, the album) is echoed back
 * in the track, so the strict match decides on it.
 */
export const startFakeLrclibApiServer = async (options: {
  tracks: readonly LrclibApiTrack[];
  failures?: readonly string[];
}): Promise<FakeLrclibApiServer> => {
  const userAgents: string[] = [];
  let requests = 0;
  let server: Server | undefined;
  server = createServer((request, response) => {
    requests += 1;
    userAgents.push(request.headers['user-agent'] ?? '');
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/get') {
      response.writeHead(404);
      response.end();
      return;
    }
    const title = url.searchParams.get('track_name') ?? '';
    if ((options.failures ?? []).includes(title)) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Upstream is overloaded' }));
      return;
    }
    const artist = url.searchParams.get('artist_name') ?? '';
    const found = options.tracks.find(
      (track) =>
        track.trackName.toLowerCase() === title.toLowerCase() &&
        track.artistName.toLowerCase() === artist.toLowerCase(),
    );
    if (found === undefined) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Not found' }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        ...found,
        albumName: url.searchParams.get('album_name') ?? found.albumName,
        duration: Number(url.searchParams.get('duration') ?? found.duration),
      }),
    );
  });
  await new Promise<void>((resolve) => {
    server?.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    userAgents,
    get requests() {
      return requests;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
};
