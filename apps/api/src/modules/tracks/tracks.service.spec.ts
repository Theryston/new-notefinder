import { Test } from '@nestjs/testing';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import { decodeTrackCursor, encodeTrackCursor } from './track-cursor.js';
import { type TrackListRow, TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

const row = (id: string, score: number): TrackListRow => ({
  id,
  score,
  createdAt: '2026-01-01 00:00:00.5+00',
  title: `Title ${id}`,
  durationSeconds: 180,
  albumId: null,
  albumName: null,
});

describe('TracksService', () => {
  let service: TracksService;
  const repository = {
    listCompleted: vi.fn(),
    countCompleted: vi.fn(),
    findArtists: vi.fn(),
    findThumbnails: vi.fn(),
    findVocalRanges: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.findArtists.mockResolvedValue([]);
    repository.findThumbnails.mockResolvedValue([]);
    repository.findVocalRanges.mockResolvedValue({ lowest: [], highest: [] });
    const moduleRef = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: TracksRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(TracksService);
  });

  describe('listCompleted', () => {
    it('asks for one extra row and returns a cursor to the last item', async () => {
      repository.listCompleted.mockResolvedValue([
        row('t1', 3),
        row('t2', 2),
        row('t3', 1),
      ]);

      const page = await service.listCompleted(
        { artistId: 'a1' },
        { limit: 2 },
      );

      expect(repository.listCompleted).toHaveBeenCalledWith(
        { artistId: 'a1' },
        { after: undefined, limit: 3 },
      );
      expect(page.items.map((item) => item.id)).toEqual(['t1', 't2']);
      expect(page.nextCursor).not.toBeNull();
      expect(decodeTrackCursor(page.nextCursor ?? '')).toEqual({
        score: 2,
        createdAt: '2026-01-01 00:00:00.5+00',
        id: 't2',
      });
      expect(repository.findArtists).toHaveBeenCalledWith(['t1', 't2']);
      expect(repository.findThumbnails).toHaveBeenCalledWith(['t1', 't2']);
      expect(repository.findVocalRanges).toHaveBeenCalledWith(['t1', 't2']);
    });

    it('has no next cursor on the last page', async () => {
      repository.listCompleted.mockResolvedValue([row('t1', 1)]);

      const page = await service.listCompleted(
        { albumId: 'al1' },
        { limit: 2 },
      );

      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });

    it('has no next cursor when the page is exactly full', async () => {
      repository.listCompleted.mockResolvedValue([row('t1', 2), row('t2', 1)]);

      const page = await service.listCompleted(
        { albumId: 'al1' },
        { limit: 2 },
      );

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBeNull();
    });

    it('continues after the cursor it is given', async () => {
      repository.listCompleted.mockResolvedValue([]);
      const key = { score: 5, createdAt: '2026-01-01 00:00:00+00', id: 't9' };

      await service.listCompleted(
        { albumId: 'al1' },
        { limit: 10, cursor: encodeTrackCursor(key) },
      );

      expect(repository.listCompleted).toHaveBeenCalledWith(
        { albumId: 'al1' },
        { after: key, limit: 11 },
      );
    });

    it('skips the related lookups for an empty page', async () => {
      repository.listCompleted.mockResolvedValue([]);

      const page = await service.listCompleted(
        { artistId: 'a1' },
        { limit: 5 },
      );

      expect(page).toEqual({ items: [], nextCursor: null });
      expect(repository.findArtists).not.toHaveBeenCalled();
      expect(repository.findThumbnails).not.toHaveBeenCalled();
      expect(repository.findVocalRanges).not.toHaveBeenCalled();
    });

    it('refuses a cursor it did not make, before querying', async () => {
      await expect(
        service.listCompleted({ artistId: 'a1' }, { limit: 5, cursor: 'nope' }),
      ).rejects.toBeInstanceOf(ZodValidationException);
      expect(repository.listCompleted).not.toHaveBeenCalled();
    });

    it('puts the related rows on their tracks', async () => {
      repository.listCompleted.mockResolvedValue([row('t1', 1)]);
      repository.findArtists.mockResolvedValue([
        { trackId: 't1', id: 'a1', name: 'Ana' },
      ]);
      repository.findVocalRanges.mockResolvedValue({
        lowest: [{ trackId: 't1', note: 'E', octave: 2 }],
        highest: [{ trackId: 't1', note: 'A', octave: 4 }],
      });

      const { items } = await service.listCompleted(
        { artistId: 'a1' },
        { limit: 5 },
      );

      expect(items[0]?.artists).toEqual([{ id: 'a1', name: 'Ana' }]);
      expect(items[0]?.vocalRange).toEqual({
        lowest: { note: 'E', octave: 2 },
        highest: { note: 'A', octave: 4 },
      });
    });
  });

  it('counts completed tracks of the owner', async () => {
    repository.countCompleted.mockResolvedValue(7);

    await expect(service.countCompleted({ artistId: 'a1' })).resolves.toBe(7);
    expect(repository.countCompleted).toHaveBeenCalledWith({ artistId: 'a1' });
  });
});
