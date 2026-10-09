import { OpenAiTranscriptionClient } from './openai-transcription.client.js';

const AUDIO: Uint8Array<ArrayBuffer> = new Uint8Array([73, 68, 51, 4]);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** The form a call of `fetch` sent; the client always sends one. */
const formSentIn = (call: Parameters<typeof fetch> | undefined): FormData => {
  const body = call?.[1]?.body;
  if (!(body instanceof FormData)) {
    throw new Error('The transcription was not sent as a form');
  }
  return body;
};

describe('OpenAiTranscriptionClient', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const answer = {
    segments: [{ id: 0, start: 0, end: 1.2, text: ' Is this' }],
    words: [{ word: ' Is', start: 0.1, end: 0.4 }],
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the vocals to whisper-1 with the key, asking for segments and words', async () => {
    fetchMock.mockResolvedValue(json(answer));

    await new OpenAiTranscriptionClient('openai-key').transcribe({
      audio: AUDIO,
      lyrics: null,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ authorization: 'Bearer openai-key' });
    const form = formSentIn(fetchMock.mock.calls[0]);
    expect(form.get('model')).toBe('whisper-1');
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.getAll('timestamp_granularities[]')).toEqual([
      'segment',
      'word',
    ]);
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      throw new Error('The vocals were not sent as a file');
    }
    expect(file.type).toBe('audio/mpeg');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(AUDIO);
  });

  it('sends no prompt when the Recording has no Lyrics', async () => {
    fetchMock.mockResolvedValue(json(answer));

    await new OpenAiTranscriptionClient('openai-key').transcribe({
      audio: AUDIO,
      lyrics: null,
    });

    expect(formSentIn(fetchMock.mock.calls[0]).has('prompt')).toBe(false);
  });

  it('guides the words with the Lyrics of the Recording as the prompt', async () => {
    fetchMock.mockResolvedValue(json(answer));

    await new OpenAiTranscriptionClient('openai-key').transcribe({
      audio: AUDIO,
      lyrics: '  Is this the real life?  ',
    });

    expect(formSentIn(fetchMock.mock.calls[0]).get('prompt')).toBe(
      'Is this the real life?',
    );
  });

  it('answers the transcription OpenAI sent back', async () => {
    fetchMock.mockResolvedValue(json(answer));

    await expect(
      new OpenAiTranscriptionClient('openai-key').transcribe({
        audio: AUDIO,
        lyrics: null,
      }),
    ).resolves.toEqual({
      segments: [{ start: 0, end: 1.2 }],
      words: [{ word: ' Is', start: 0.1, end: 0.4 }],
    });
  });

  it('fails when OpenAI refuses the request, without a transcription', async () => {
    fetchMock.mockResolvedValue(json({ error: 'invalid key' }, 401));

    await expect(
      new OpenAiTranscriptionClient('openai-key').transcribe({
        audio: AUDIO,
        lyrics: null,
      }),
    ).rejects.toThrow('OpenAI answered HTTP 401');
  });

  it('fails without calling OpenAI when no key is set', async () => {
    await expect(
      new OpenAiTranscriptionClient(undefined).transcribe({
        audio: AUDIO,
        lyrics: null,
      }),
    ).rejects.toThrow('OPENAI_API_KEY is not set');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
