import { Test } from '@nestjs/testing';
import { TrackDirectAudioRepository } from './track-direct-audio.repository.js';
import { TrackDirectAudioService } from './track-direct-audio.service.js';

const repository = { findLatestCompleted: vi.fn() };
const audio = {
  musicMp3Url: 'https://audio.example/music.mp3',
  vocalsMp3Url: 'https://audio.example/vocals.mp3',
};

describe('direct audio licensing', () => {
  let service: TrackDirectAudioService;
  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackDirectAudioService,
        { provide: TrackDirectAudioRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(TrackDirectAudioService);
  });

  it.each([undefined, { role: 'USER' as const }])(
    'refuses an unauthorized listener before looking up URLs',
    async (user) => {
      await expect(service.getAudio('track', user)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(repository.findLatestCompleted).not.toHaveBeenCalled();
    },
  );

  it('returns only the completed Processing MP3 URLs to an admin', async () => {
    repository.findLatestCompleted.mockResolvedValue({
      ...audio,
      musicWavUrl: 'private-wav',
    });
    await expect(service.getAudio('track', { role: 'ADMIN' })).resolves.toEqual(
      audio,
    );
    expect(repository.findLatestCompleted).toHaveBeenCalledWith('track');
  });

  it.each([
    undefined,
    { musicMp3Url: null, vocalsMp3Url: audio.vocalsMp3Url },
    { musicMp3Url: audio.musicMp3Url, vocalsMp3Url: null },
  ])('refuses unavailable audio', async (row) => {
    repository.findLatestCompleted.mockResolvedValue(row);
    await expect(
      service.getAudio('track', { role: 'ADMIN' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
