import {
  NoteDetectionClient,
  type NoteDetectionInput,
} from './note-detection.client.js';

const config = { apiKey: 'runpod-key', endpointId: 'endpoint-1' };

const input: NoteDetectionInput = {
  processingId: 'processing-1',
  musicUrl: 'https://files.test/track-audio/track-1/processing-1.wav',
  vocalsUpload: {
    presignedPutUrl: 'https://files.test/vocals.wav?X-Amz-Signature=1',
    contentType: 'audio/wav',
    publicUrl: 'https://files.test/track-vocals/track-1/processing-1.wav',
  },
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('NoteDetectionClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('startJob', () => {
    it('posts the input to the endpoint /run, with the key as a bearer token', async () => {
      fetchMock.mockResolvedValue(json({ id: 'job-1', status: 'IN_QUEUE' }));

      await expect(
        new NoteDetectionClient(config).startJob(input),
      ).resolves.toBe('job-1');

      const [url, init] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBe('https://api.runpod.ai/v2/endpoint-1/run');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({
        authorization: 'Bearer runpod-key',
        'content-type': 'application/json',
      });
      expect(JSON.parse(String(init?.body))).toEqual({ input });
    });

    it('fails when RunPod refuses the job', async () => {
      fetchMock.mockResolvedValue(json({ error: 'unauthorized' }, 401));

      await expect(
        new NoteDetectionClient(config).startJob(input),
      ).rejects.toThrow('RunPod answered HTTP 401');
    });

    it('calls nothing without its configuration', async () => {
      await expect(
        new NoteDetectionClient(undefined).startJob(input),
      ).rejects.toThrow('RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are not set');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('checkJob', () => {
    it('reads the job from the endpoint /status and answers its state', async () => {
      fetchMock.mockResolvedValue(
        json({
          id: 'job-1',
          status: 'IN_PROGRESS',
          output: 'DETECTING_NOTES',
        }),
      );

      await expect(
        new NoteDetectionClient(config).checkJob('job-1'),
      ).resolves.toEqual({ kind: 'running', stage: 'DETECTING_NOTES' });

      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        'https://api.runpod.ai/v2/endpoint-1/status/job-1',
      );
    });

    it('escapes the job ID in the URL', async () => {
      fetchMock.mockResolvedValue(json({ id: 'a/b', status: 'IN_QUEUE' }));

      await new NoteDetectionClient(config).checkJob('a/b?x');

      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        'https://api.runpod.ai/v2/endpoint-1/status/a%2Fb%3Fx',
      );
    });

    it('fails when RunPod cannot answer', async () => {
      fetchMock.mockResolvedValue(json({ error: 'busy' }, 503));

      await expect(
        new NoteDetectionClient(config).checkJob('job-1'),
      ).rejects.toThrow('RunPod answered HTTP 503');
    });

    it('calls nothing without its configuration', async () => {
      await expect(
        new NoteDetectionClient(undefined).checkJob('job-1'),
      ).rejects.toThrow('not set');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
