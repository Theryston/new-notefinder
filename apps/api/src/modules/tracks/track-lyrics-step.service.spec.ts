import { Test, type TestingModule } from '@nestjs/testing';
import { OpenAiTranscriptionClient } from '../../integrations/openai/openai-transcription.client.js';
import { TrackLyricsPromptService } from './track-lyrics-prompt.service.js';
import { TrackLyricsStepService } from './track-lyrics-step.service.js';
import { TrackMp3Service } from './track-mp3.service.js';
import type { ProcessingForStep } from './track-processing.repository.js';
import { DONE, STOPPED } from './track-step-outcome.js';
import { TrackTimedLyricsService } from './track-timed-lyrics.service.js';

// The lyrics step's decisions: when the Track's lines are cleared, what the
// music job is queued with, what guides and what is saved. The MP3s, the catalog,
// OpenAI and the guarded write are fakes; the e2e spec runs the real ones.

// The music MP3 is only queued: this fake has no way to convert it, so a call to
// it would fail the step, which is what the independence case relies on.
const mp3s = { queueMusicMp3: vi.fn(), storeVocalsMp3: vi.fn() };
const transcription = { transcribe: vi.fn() };
const prompt = { lyricsOf: vi.fn() };
const timedLyrics = { replace: vi.fn() };

const VOCALS = new Uint8Array([73, 68, 51]) as Uint8Array<ArrayBuffer>;

const processing: ProcessingForStep = {
  id: 'processing-1',
  trackId: 'track-1',
  status: 'EXTRACTING_LYRICS',
  videoId: 'aaaaaaaaaaa',
  videoSource: 'musicbrainz',
};

const transcribed = {
  segments: [{ start: 0, end: 1.2 }],
  words: [
    { word: ' Is', start: 0.1, end: 0.4 },
    { word: ' this', start: 0.5, end: 0.9 },
  ],
};

const expectedLines = [
  {
    start: 0,
    end: 1.2,
    words: [
      { text: 'Is', start: 0.1, end: 0.4 },
      { text: 'this', start: 0.5, end: 0.9 },
    ],
  },
];

describe('TrackLyricsStepService', () => {
  let service: TrackLyricsStepService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    mp3s.queueMusicMp3.mockResolvedValue(undefined);
    mp3s.storeVocalsMp3.mockResolvedValue(VOCALS);
    transcription.transcribe.mockResolvedValue(transcribed);
    prompt.lyricsOf.mockResolvedValue('Is this the real life?');
    timedLyrics.replace.mockResolvedValue(true);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackLyricsStepService,
        { provide: TrackMp3Service, useValue: mp3s },
        { provide: OpenAiTranscriptionClient, useValue: transcription },
        { provide: TrackLyricsPromptService, useValue: prompt },
        { provide: TrackTimedLyricsService, useValue: timedLyrics },
      ],
    }).compile();
    service = moduleRef.get(TrackLyricsStepService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('clears the lines of an earlier Processing as the stage starts, before any transcription', async () => {
    await service.run(processing);

    expect(timedLyrics.replace).toHaveBeenNthCalledWith(1, processing, []);
    expect(timedLyrics.replace.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      transcription.transcribe.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('stops without transcribing when the Processing has already moved on', async () => {
    timedLyrics.replace.mockResolvedValue(false);

    await expect(service.run(processing)).resolves.toEqual(STOPPED);

    expect(mp3s.storeVocalsMp3).not.toHaveBeenCalled();
    expect(transcription.transcribe).not.toHaveBeenCalled();
  });

  it('queues the music MP3 as a job of its own, and never waits for it', async () => {
    await expect(service.run(processing)).resolves.toEqual(DONE);

    expect(mp3s.queueMusicMp3).toHaveBeenCalledWith(processing);
    expect(transcription.transcribe).toHaveBeenCalledTimes(1);
  });

  it("stores the vocals as MP3, then transcribes them guided by the Recording's Lyrics", async () => {
    await service.run(processing);

    expect(mp3s.storeVocalsMp3).toHaveBeenCalledWith(processing);
    expect(prompt.lyricsOf).toHaveBeenCalledWith('track-1');
    expect(transcription.transcribe).toHaveBeenCalledWith({
      audio: VOCALS,
      lyrics: 'Is this the real life?',
    });
  });

  it('transcribes without a prompt when the Recording has no Lyrics', async () => {
    prompt.lyricsOf.mockResolvedValue(null);

    await service.run(processing);

    expect(transcription.transcribe).toHaveBeenCalledWith({
      audio: VOCALS,
      lyrics: null,
    });
  });

  it("saves the lines of the transcription as the Track's Timed lyrics", async () => {
    await expect(service.run(processing)).resolves.toEqual(DONE);

    expect(timedLyrics.replace).toHaveBeenLastCalledWith(
      processing,
      expectedLines,
    );
  });

  it('stops without saving when the Processing moved on during the step', async () => {
    timedLyrics.replace
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(service.run(processing)).resolves.toEqual(STOPPED);
  });

  it('lets a failed transcription throw, so the pipeline retries the step', async () => {
    transcription.transcribe.mockRejectedValue(new Error('OpenAI is down'));

    await expect(service.run(processing)).rejects.toThrow('OpenAI is down');
    expect(timedLyrics.replace).toHaveBeenCalledTimes(1);
  });

  it('lets a failed vocals MP3 throw, so nothing is transcribed', async () => {
    mp3s.storeVocalsMp3.mockRejectedValue(new Error('conversion failed'));

    await expect(service.run(processing)).rejects.toThrow('conversion failed');
    expect(transcription.transcribe).not.toHaveBeenCalled();
  });
});
