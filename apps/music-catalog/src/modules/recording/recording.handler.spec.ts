import type { Recording } from '@notefinder/contracts';
import { createGetRecordingHandler } from './recording.handler.js';
import type { RecordingService } from './recording.service.js';

const MBID = '00000000-0000-4000-8000-000000000100';

const recording: Recording = {
  mbid: MBID,
  title: 'Song',
  lengthMs: null,
  disambiguation: '',
  video: false,
  isrcs: [],
  artistCredit: { name: 'Artist', artists: [] },
  releases: [],
  works: [],
  genres: [],
  tags: [],
  tagsSource: null,
  externalUrls: [],
  lyrics: { plain: null, synced: null },
};

const setup = () => {
  const service = { getRecording: vi.fn(async () => recording) };
  const handler = createGetRecordingHandler(
    service as unknown as RecordingService,
  );
  return { handler, service };
};

describe('createGetRecordingHandler', () => {
  it('answers the getRecording request type', () => {
    expect(setup().handler.type).toBe('getRecording');
  });

  it('asks the service for the MBID of the payload', async () => {
    const { handler, service } = setup();

    await expect(handler.handle({ mbid: MBID })).resolves.toEqual(recording);
    expect(service.getRecording).toHaveBeenCalledExactlyOnceWith(MBID);
  });

  it.each([
    ['no payload', undefined],
    ['an empty payload', {}],
    ['a number', { mbid: 7 }],
    ['text that is not an MBID', { mbid: 'nope' }],
  ])('refuses %s before reaching the service', async (_label, payload) => {
    const { handler, service } = setup();

    await expect(handler.handle(payload)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(service.getRecording).not.toHaveBeenCalled();
  });

  it('never lets a field outside the contract reach a client', async () => {
    const { handler, service } = setup();
    service.getRecording.mockResolvedValueOnce({
      ...recording,
      internalId: 7,
    } as Recording);

    await expect(handler.handle({ mbid: MBID })).resolves.not.toHaveProperty(
      'internalId',
    );
  });
});
