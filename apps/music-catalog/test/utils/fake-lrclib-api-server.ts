import { createServer, type Server, type ServerResponse } from 'node:http';
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
 * in the track, so the strict match decides on it — except the titles listed
 * in `verbatimTitles`, which are served as stored, so a non-matching track
 * stays non-matching. `beforeResponse` runs before every answer: hold it to
 * simulate a hung upstream while the tick keeps draining behind it.
 */
const answerJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
): void => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const findTrack = (
  tracks: readonly LrclibApiTrack[],
  url: URL,
  title: string,
): LrclibApiTrack | undefined => {
  const artist = url.searchParams.get('artist_name') ?? '';
  return tracks.find(
    (track) =>
      track.trackName.toLowerCase() === title.toLowerCase() &&
      track.artistName.toLowerCase() === artist.toLowerCase(),
  );
};

// The queried album and duration, echoed the way the fake keeps every
// configured track matching: verbatim titles skip this.
const echoQuery = (found: LrclibApiTrack, url: URL): LrclibApiTrack => ({
  ...found,
  albumName: url.searchParams.get('album_name') ?? found.albumName,
  duration: Number(url.searchParams.get('duration') ?? found.duration),
});

export const startFakeLrclibApiServer = async (options: {
  tracks: readonly LrclibApiTrack[];
  failures?: readonly string[];
  verbatimTitles?: readonly string[];
  beforeResponse?: (title: string) => Promise<void>;
}): Promise<FakeLrclibApiServer> => {
  const userAgents: string[] = [];
  let requests = 0;
  let server: Server | undefined;
  server = createServer(async (request, response) => {
    requests += 1;
    userAgents.push(request.headers['user-agent'] ?? '');
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/get') {
      response.writeHead(404);
      response.end();
      return;
    }
    const title = url.searchParams.get('track_name') ?? '';
    await options.beforeResponse?.(title);
    if ((options.failures ?? []).includes(title)) {
      answerJson(response, 500, { message: 'Upstream is overloaded' });
      return;
    }
    const found = findTrack(options.tracks, url, title);
    if (found === undefined) {
      answerJson(response, 404, { message: 'Not found' });
      return;
    }
    const verbatim = (options.verbatimTitles ?? []).includes(title);
    answerJson(response, 200, verbatim ? found : echoQuery(found, url));
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
