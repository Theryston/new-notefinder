import { CoverArtClient } from './cover-art.client.js';

// `fetch` is stubbed: the archive and the CDN are never reached from a test.
const fetchMock =
  vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const imageResponse = (
  body: Uint8Array<ArrayBuffer>,
  headers: Record<string, string> = { 'content-type': 'image/jpeg' },
) => new Response(body, { status: 200, headers });

describe('CoverArtClient', () => {
  let client: CoverArtClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    client = new CoverArtClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads the front cover of a release at 500 px', async () => {
    fetchMock.mockResolvedValue(imageResponse(new Uint8Array([1, 2, 3])));

    await expect(
      client.fetchReleaseFrontCover('11111111-2222-3333-4444-555555555555'),
    ).resolves.toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://coverartarchive.org/release/11111111-2222-3333-4444-555555555555/front-500',
    );
  });

  it('answers no cover for a 404, which is an answer and not a failure', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(client.fetchReleaseFrontCover('mbid')).resolves.toBe(
      undefined,
    );
  });

  it('throws on a server error, so the job is retried', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(client.fetchImage('https://img.test/a.jpg')).rejects.toThrow(
      'HTTP 503',
    );
  });

  it('refuses a download that is not an image', async () => {
    fetchMock.mockResolvedValue(
      imageResponse(new Uint8Array([1]), { 'content-type': 'text/html' }),
    );

    await expect(client.fetchImage('https://img.test/a')).resolves.toBe(
      undefined,
    );
  });

  it('refuses an image that declares a size over the limit before reading it', async () => {
    fetchMock.mockResolvedValue(
      imageResponse(new Uint8Array([1]), {
        'content-type': 'image/png',
        'content-length': String(11 * 1024 * 1024),
      }),
    );

    await expect(client.fetchImage('https://img.test/big')).resolves.toBe(
      undefined,
    );
  });

  it('refuses an image whose body is over the limit', async () => {
    fetchMock.mockResolvedValue(
      imageResponse(new Uint8Array(10 * 1024 * 1024 + 1)),
    );

    await expect(client.fetchImage('https://img.test/big')).resolves.toBe(
      undefined,
    );
  });
});
