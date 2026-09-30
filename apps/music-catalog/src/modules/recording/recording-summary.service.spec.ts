import type { RecordingSummaryRepository } from './recording-summary.repository.js';
import { RecordingSummaryService } from './recording-summary.service.js';
import type { RecordingSummaryRow } from './recording-summary-data.js';

const row = (mbid: string, title: string): RecordingSummaryRow => ({
  mbid,
  title,
  lengthMs: null,
  disambiguation: '',
  video: false,
  artistCreditName: 'Artist',
  artists: [],
  primaryRelease: null,
  genreLevels: { recording: [], release_group: [], artist: [] },
});

const setup = (rows: RecordingSummaryRow[] = []) => {
  const repository = { findByMbids: vi.fn(async () => rows) };
  const service = new RecordingSummaryService(
    repository as unknown as RecordingSummaryRepository,
  );
  return { service, repository };
};

describe('RecordingSummaryService', () => {
  describe('findByMbids', () => {
    it('reads all the MBIDs in one query and assembles a summary from each row', async () => {
      const { service, repository } = setup([row('a', 'A'), row('b', 'B')]);

      const summaries = await service.findByMbids(['a', 'b', 'c']);

      expect(repository.findByMbids).toHaveBeenCalledExactlyOnceWith([
        'a',
        'b',
        'c',
      ]);
      expect(summaries).toMatchObject([
        { mbid: 'a', title: 'A', primaryRelease: null },
        { mbid: 'b', title: 'B', primaryRelease: null },
      ]);
    });

    it('does not query for no MBIDs', async () => {
      const { service, repository } = setup();

      await expect(service.findByMbids([])).resolves.toEqual([]);
      expect(repository.findByMbids).not.toHaveBeenCalled();
    });
  });
});
