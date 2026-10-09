import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { AudioDownloadClient } from './audio-download.client.js';

// `fetch` is stubbed: RapidAPI and the file host are never reached from a test.
const fetchMock =
  vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const PROGRESS_URL = 'https://rapidapi.test/progress/abc';

describe('AudioDownloadClient', () => {
  let client: AudioDownloadClient;
  let moduleRef: TestingModule | undefined;

  // Builds the client with this env, closing the module of the previous build.
  const configure = async (env: Record<string, unknown> = {}) => {
    await moduleRef?.close();
    moduleRef = undefined;
    const built = await Test.createTestingModule({
      providers: [
        AudioDownloadClient,
        { provide: ENV, useValue: { NODE_ENV: 'test', ...env } },
      ],
    }).compile();
    moduleRef = built;
    client = built.get(AudioDownloadClient);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    await configure({ RAPIDAPI_API_KEY: 'rapid-key' });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await moduleRef?.close();
    moduleRef = undefined;
  });

  describe('requestConversion', () => {
    it('asks RapidAPI for the same MP3 of the video as the legacy service', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ progress_url: PROGRESS_URL }));

      await expect(client.requestConversion('abc')).resolves.toBe(PROGRESS_URL);

      const [url, init] = fetchMock.mock.calls[0] ?? [];
      const requested = new URL(url ?? '');
      expect(`${requested.origin}${requested.pathname}`).toBe(
        'https://youtube-info-download-api.p.rapidapi.com/ajax/download.php',
      );
      expect(Object.fromEntries(requested.searchParams)).toEqual({
        format: 'mp3',
        add_info: '0',
        url: 'https://www.youtube.com/watch?v=abc',
        audio_quality: '128',
        allow_extended_duration: 'false',
        no_merge: 'true',
        audio_language: 'en',
      });
      const headers = new Headers(init?.headers);
      expect(headers.get('x-rapidapi-key')).toBe('rapid-key');
      expect(headers.get('x-rapidapi-host')).toBe(
        'youtube-info-download-api.p.rapidapi.com',
      );
    });

    it('fails on an error answer, so the step can be retried', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

      await expect(client.requestConversion('abc')).rejects.toThrow(
        'RapidAPI answered HTTP 503',
      );
    });

    it('fails without calling RapidAPI when no key is configured', async () => {
      await configure();

      await expect(client.requestConversion('abc')).rejects.toThrow(
        'RAPIDAPI_API_KEY is not set',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('checkConversion', () => {
    it('answers that the conversion is still running', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ progress: 400 }));

      await expect(client.checkConversion(PROGRESS_URL)).resolves.toEqual({
        ready: false,
      });
      expect(fetchMock.mock.calls[0]?.[0]).toBe(PROGRESS_URL);
    });

    it('answers the download URL once the conversion has finished', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          progress: 1000,
          download_url: 'https://files.test/a.mp3',
        }),
      );

      await expect(client.checkConversion(PROGRESS_URL)).resolves.toEqual({
        ready: true,
        downloadUrl: 'https://files.test/a.mp3',
      });
    });

    it('fails on an error answer', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

      await expect(client.checkConversion(PROGRESS_URL)).rejects.toThrow(
        'RapidAPI answered HTTP 500',
      );
    });
  });

  describe('downloadMp3', () => {
    it('answers the bytes of the MP3', async () => {
      fetchMock.mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-length': '3' },
        }),
      );

      await expect(
        client.downloadMp3('https://files.test/a.mp3'),
      ).resolves.toEqual(new Uint8Array([1, 2, 3]));
    });

    it('fails on an error answer', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

      await expect(
        client.downloadMp3('https://files.test/a.mp3'),
      ).rejects.toThrow('The MP3 download answered HTTP 404');
    });

    it('refuses a file declared larger than the accepted size, before reading it', async () => {
      fetchMock.mockResolvedValue(
        new Response(new Uint8Array([1]), {
          headers: { 'content-length': String(65 * 1024 * 1024) },
        }),
      );

      await expect(
        client.downloadMp3('https://files.test/a.mp3'),
      ).rejects.toThrow('larger than the accepted size');
    });
  });
});
