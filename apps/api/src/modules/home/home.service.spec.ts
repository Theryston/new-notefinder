import { Test } from '@nestjs/testing';
import type { HomeRow } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { HomeService } from './home.service.js';
import { encodeHomeCursor } from './home-cursor.js';
import { type StoredHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';

const VERSION = 'a1b2c3d4e5f60718';

const rows = (count: number): HomeRow[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    layout: 'standard',
    title: { key: 'home.rows.newTracks', params: {} },
    items: [],
  }));

const feedOf = (version: string, count: number): StoredHomeFeed => ({
  audience: 'public',
  version,
  algorithmVersion: 1,
  rows: rows(count),
});

const rowIds = (page: { rows: HomeRow[] }) => page.rows.map((row) => row.id);

describe('HomeService', () => {
  let service: HomeService;
  const feeds = { currentPublic: vi.fn(), publicVersion: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [HomeService, { provide: HomeFeedService, useValue: feeds }],
    }).compile();
    service = moduleRef.get(HomeService);
  });

  it('answers the first six rows of the current feed with a cursor while rows remain', async () => {
    feeds.currentPublic.mockResolvedValue({
      feed: feedOf(VERSION, 8),
      cacheable: true,
    });

    const { page, cacheable } = await service.getPage(undefined);

    expect(cacheable).toBe(true);
    expect(page).toMatchObject({ audience: 'public', version: VERSION });
    expect(page.algorithmVersion).toBe(1);
    expect(rowIds(page)).toEqual([
      'row-0',
      'row-1',
      'row-2',
      'row-3',
      'row-4',
      'row-5',
    ]);
    expect(page.nextCursor).toBe(
      encodeHomeCursor({ version: VERSION, position: 6 }),
    );
  });

  it('answers no cursor on the last page', async () => {
    feeds.currentPublic.mockResolvedValue({
      feed: feedOf(VERSION, 4),
      cacheable: true,
    });

    const { page } = await service.getPage(undefined);

    expect(rowIds(page)).toEqual(['row-0', 'row-1', 'row-2', 'row-3']);
    expect(page.nextCursor).toBeNull();
  });

  it('answers an empty page with no cursor for an empty feed', async () => {
    feeds.currentPublic.mockResolvedValue({
      feed: feedOf(VERSION, 0),
      cacheable: true,
    });

    const { page } = await service.getPage(undefined);

    expect(page.rows).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('resumes a cursor at its position in the version it names', async () => {
    feeds.publicVersion.mockResolvedValue(feedOf(VERSION, 9));
    const cursor = encodeHomeCursor({ version: VERSION, position: 6 });

    const { page, cacheable } = await service.getPage(cursor);

    expect(feeds.publicVersion).toHaveBeenCalledWith(VERSION);
    expect(cacheable).toBe(true);
    expect(rowIds(page)).toEqual(['row-6', 'row-7', 'row-8']);
    expect(page.nextCursor).toBeNull();
  });

  it('answers 404 NOT_FOUND with the expired reason when the cursor names a version that is gone', async () => {
    feeds.publicVersion.mockResolvedValue(undefined);
    const cursor = encodeHomeCursor({
      version: '0000000000000000',
      position: 6,
    });

    const error = await service.getPage(cursor).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      details: { reason: 'FEED_VERSION_EXPIRED' },
    });
    expect((error as AppException).getStatus()).toBe(404);
  });

  it('refuses a malformed cursor before looking up any feed', async () => {
    const error = await service.getPage('garbage').catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(feeds.publicVersion).not.toHaveBeenCalled();
  });

  it('passes the uncacheable fallback home through', async () => {
    feeds.currentPublic.mockResolvedValue({
      feed: feedOf('minimal', 0),
      cacheable: false,
    });

    await expect(service.getPage(undefined)).resolves.toMatchObject({
      cacheable: false,
    });
  });
});
