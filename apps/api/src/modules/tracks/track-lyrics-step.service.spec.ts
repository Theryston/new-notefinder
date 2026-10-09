import { Test, type TestingModule } from '@nestjs/testing';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { OpenAiTranscriptionClient } from '../../integrations/openai/openai-transcription.client.js';
import { TrackLyricsRepository } from './track-lyrics.repository.js';
import { TrackLyricsPromptService } from './track-lyrics-prompt.service.js';
import { TrackLyricsStepService } from './track-lyrics-step.service.js';
import { TrackMp3Service } from './track-mp3.service.js';
import type { ProcessingForStep } from './track-processing.repository.js';
import { DONE, STOPPED } from './track-step-outcome.js';

// The lyrics step's decisions: what it stores, what guides the transcription,
// what it saves and when it stops. The MP3s, the catalog, OpenAI and the rows
// are fakes; the e2e spec runs the real ones.

// `replaceTimedLyrics` is `@Transactional()`: the database module runs it on a
// stand-in transaction client, so the write path runs without a database.
const tx = { name: 'tx' };
const db = {
  name: 'db',
  transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  ),
};
const pool = { end: vi.fn(async () => {}) };

const mp3s = { storeMusicMp3: vi.fn(), storeVocalsMp3: vi.fn() };
const transcription = { transcribe: vi.fn() };
const prompt = { lyricsOf: vi.fn() };
const timedLyrics = { replaceTimedLyrics: vi.fn() };

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
    mp3s.storeVocalsMp3.mockResolvedValue(VOCALS);
    transcription.transcribe.mockResolvedValue(transcribed);
    prompt.lyricsOf.mockResolvedValue('Is this the real life?');
    timedLyrics.replaceTimedLyrics.mockResolvedValue(true);
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackLyricsStepService,
        { provide: TrackMp3Service, useValue: mp3s },
        { provide: OpenAiTranscriptionClient, useValue: transcription },
        { provide: TrackLyricsPromptService, useValue: prompt },
        { provide: TrackLyricsRepository, useValue: timedLyrics },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(TrackLyricsStepService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("stores both MP3s, then transcribes the vocals guided by the Recording's Lyrics", async () => {
    await service.run(processing);

    expect(mp3s.storeMusicMp3).toHaveBeenCalledWith(processing);
    expect(mp3s.storeVocalsMp3).toHaveBeenCalledWith(processing);
    expect(prompt.lyricsOf).toHaveBeenCalledWith('track-1');
    expect(transcription.transcribe).toHaveBeenCalledWith({
      audio: VOCALS,
      lyrics: 'Is this the real life?',
    });
  });

  it("saves the lines of the transcription as the Track's Timed lyrics", async () => {
    await expect(service.run(processing)).resolves.toEqual(DONE);

    expect(timedLyrics.replaceTimedLyrics).toHaveBeenCalledWith(
      'processing-1',
      'track-1',
      expectedLines,
    );
  });

  it('transcribes without a prompt when the Recording has no Lyrics', async () => {
    prompt.lyricsOf.mockResolvedValue(null);

    await service.run(processing);

    expect(transcription.transcribe).toHaveBeenCalledWith({
      audio: VOCALS,
      lyrics: null,
    });
  });

  it('stops without saving when the Processing moved on during the step', async () => {
    timedLyrics.replaceTimedLyrics.mockResolvedValue(false);

    await expect(service.run(processing)).resolves.toEqual(STOPPED);
  });

  it('lets a failed transcription throw, so the pipeline retries the step', async () => {
    transcription.transcribe.mockRejectedValue(new Error('OpenAI is down'));

    await expect(service.run(processing)).rejects.toThrow('OpenAI is down');
    expect(timedLyrics.replaceTimedLyrics).not.toHaveBeenCalled();
  });

  it('transcribes nothing when an MP3 could not be stored', async () => {
    mp3s.storeMusicMp3.mockRejectedValue(new Error('conversion failed'));

    await expect(service.run(processing)).rejects.toThrow('conversion failed');
    expect(transcription.transcribe).not.toHaveBeenCalled();
  });
});
