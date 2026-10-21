import { Test, type TestingModule } from '@nestjs/testing';
import type { EditorialPin, HomeRow } from '@notefinder/contracts';
import { EditorialPinsService } from '../editorial-pins/editorial-pins.service.js';
import { HomeRepository, type HomeTrackRecord } from './home.repository.js';
import {
  HomePinOverlayService,
  PINNED_ROW_TITLE_KEY,
} from './home-pin-overlay.service.js';

const pins = { findLivePins: vi.fn() };
const repository = { findCompletedTracksByIds: vi.fn() };

const record = (id: string): HomeTrackRecord => ({
  id,
  title: `Track ${id}`,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  lengthMs: 180000,
  vocalRangeLowest: 60,
  vocalRangeHighest: 72,
});

const livePin = (overrides: Partial<EditorialPin> = {}): EditorialPin => ({
  id: 'pin-1',
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['t1', 't2'] },
  position: 1,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  sponsored: true,
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const feedRows = (): HomeRow[] => [
  {
    id: 'hero',
    layout: 'hero',
    track: {
      id: 'algo',
      title: 'Algorithmic',
      coverUrl: null,
      artistCredit: [],
      durationMs: null,
      vocalRange: null,
    },
  },
];

describe('HomePinOverlayService', () => {
  let service: HomePinOverlayService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        HomePinOverlayService,
        { provide: EditorialPinsService, useValue: pins },
        { provide: HomeRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(HomePinOverlayService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('returns the rows as they are, without reading any Track, when no pin is live', async () => {
    pins.findLivePins.mockResolvedValue([]);
    const rows = feedRows();

    await expect(
      service.apply(rows, { locale: 'en', signedIn: false }),
    ).resolves.toBe(rows);
    expect(repository.findCompletedTracksByIds).not.toHaveBeenCalled();
  });

  it('reads the pins for the viewer and applies them with their titles in the feed locale', async () => {
    pins.findLivePins.mockResolvedValue([livePin()]);
    repository.findCompletedTracksByIds.mockResolvedValue([
      record('t1'),
      record('t2'),
    ]);

    const rows = await service.apply(feedRows(), {
      locale: 'pt-BR',
      signedIn: true,
    });

    expect(pins.findLivePins).toHaveBeenCalledWith({
      locale: 'pt-BR',
      signedIn: true,
    });
    expect(repository.findCompletedTracksByIds).toHaveBeenCalledWith([
      't1',
      't2',
    ]);
    expect(rows[1]).toMatchObject({
      id: 'pin-pin-1',
      layout: 'standard',
      sponsored: true,
      title: { key: PINNED_ROW_TITLE_KEY, params: { title: 'Festivo' } },
      items: [
        expect.objectContaining({ id: 't1', durationMs: 180000 }),
        expect.objectContaining({ id: 't2' }),
      ],
    });
  });

  it('skips a Track that is no longer completed, without failing the pin', async () => {
    pins.findLivePins.mockResolvedValue([livePin()]);
    repository.findCompletedTracksByIds.mockResolvedValue([record('t2')]);

    const rows = await service.apply(feedRows(), {
      locale: 'en',
      signedIn: false,
    });

    expect(rows[1]).toMatchObject({
      id: 'pin-pin-1',
      items: [expect.objectContaining({ id: 't2' })],
    });
  });

  it('drops a pin that has no title in the feed locale', async () => {
    pins.findLivePins.mockResolvedValue([
      livePin({ titles: { en: 'Festive' } }),
    ]);
    repository.findCompletedTracksByIds.mockResolvedValue([record('t1')]);

    const rows = await service.apply(feedRows(), {
      locale: 'pt-BR',
      signedIn: false,
    });

    expect(rows).toHaveLength(1);
  });
});
