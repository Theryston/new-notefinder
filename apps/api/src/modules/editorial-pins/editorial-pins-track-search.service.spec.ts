import { Test, type TestingModule } from '@nestjs/testing';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import { EditorialPinsRepository } from './editorial-pins.repository.js';
import { EditorialPinsService } from './editorial-pins.service.js';

const repository = {
  searchPinTracks: vi.fn(),
  findPinTracksByIds: vi.fn(),
};

describe('EditorialPinsService track search', () => {
  let service: EditorialPinsService;
  let moduleRef: TestingModule;

  const recordOf = (id: string) => ({
    id,
    title: `Song ${id}`,
    artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
    coverUrl: `https://cdn.example/${id}.webp`,
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        EditorialPinsService,
        { provide: EditorialPinsRepository, useValue: repository },
        {
          provide: EditorialPinScheduleService,
          useValue: { invalidateNow: vi.fn(), scheduleEdges: vi.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(EditorialPinsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('lists the query matches with only names and join phrases', async () => {
    repository.searchPinTracks.mockResolvedValue([
      recordOf('t1'),
      {
        ...recordOf('t2'),
        artistCredit: [{ name: 'Duo', joinPhrase: ' feat. ', mbid: 'mbid-1' }],
      },
    ]);

    const result = await service.searchPinTracks({
      q: 'song',
      kind: 'row',
      limit: 10,
    });

    expect(repository.searchPinTracks).toHaveBeenCalledWith({
      q: 'song',
      kind: 'row',
      limit: 10,
    });
    expect(result).toEqual({
      items: [
        {
          id: 't1',
          title: 'Song t1',
          artistCredit: [{ name: 'Artist t1', joinPhrase: '' }],
          coverUrl: 'https://cdn.example/t1.webp',
        },
        {
          id: 't2',
          title: 'Song t2',
          artistCredit: [{ name: 'Duo', joinPhrase: ' feat. ' }],
          coverUrl: 'https://cdn.example/t2.webp',
        },
      ],
    });
  });

  it('resolves explicit IDs in order, dropping blanks and duplicates', async () => {
    repository.findPinTracksByIds.mockResolvedValue([recordOf('b')]);

    const result = await service.searchPinTracks({
      ids: 'b, ,b,a',
      limit: 10,
    });

    expect(repository.findPinTracksByIds).toHaveBeenCalledWith(['b', 'a']);
    expect(result).toEqual({
      items: [
        {
          id: 'b',
          title: 'Song b',
          artistCredit: [{ name: 'Artist b', joinPhrase: '' }],
          coverUrl: 'https://cdn.example/b.webp',
        },
      ],
    });
  });
});
