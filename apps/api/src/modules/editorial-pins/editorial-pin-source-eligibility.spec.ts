import { AppException } from '../../common/errors/app-exception.js';
import { assertSourceEligible } from './editorial-pin-source-eligibility.js';
import type { EditorialPinWrite } from './editorial-pin-state.js';
import type { EditorialPinsRepository } from './editorial-pins.repository.js';

const writeOf = (
  overrides: Partial<EditorialPinWrite> = {},
): EditorialPinWrite => ({
  kind: 'row',
  layout: 'standard',
  position: 2,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Festive' },
  sponsored: false,
  trackIds: ['t1'],
  dynamicSource: null,
  ...overrides,
});

const pinsRepository = () =>
  ({
    findCompletedTracks: vi.fn(),
    sourceExists: vi.fn(),
    findSourceTrackIds: vi.fn(),
  }) as unknown as EditorialPinsRepository;

const issuesOf = async (call: Promise<unknown>) => {
  const error = await call.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppException);
  return (error as AppException).toApiError().details as {
    issues: unknown[];
  };
};

describe('assertSourceEligible', () => {
  it('carries a reason for Tracks without a completed processing', async () => {
    const pins = pinsRepository();
    vi.mocked(pins.findCompletedTracks).mockResolvedValue([]);

    const { issues } = await issuesOf(
      assertSourceEligible(pins, writeOf({ trackIds: ['t1', 't2'] })),
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        reason: 'TRACK_NOT_COMPLETED',
        trackId: 't1',
      }),
      expect.objectContaining({
        code: 'custom',
        reason: 'TRACK_NOT_COMPLETED',
        trackId: 't2',
      }),
    ]);
  });

  it('carries a reason when a hero Track has no cover', async () => {
    const pins = pinsRepository();
    vi.mocked(pins.findCompletedTracks).mockResolvedValue([
      { id: 't1', coverUrl: null },
    ]);

    const { issues } = await issuesOf(
      assertSourceEligible(pins, writeOf({ kind: 'hero', trackIds: ['t1'] })),
    );

    expect(issues).toEqual([
      expect.objectContaining({ reason: 'TRACK_NO_COVER', trackId: 't1' }),
    ]);
  });

  it('carries a reason for a missing dynamic source', async () => {
    const pins = pinsRepository();
    vi.mocked(pins.sourceExists).mockResolvedValue(false);

    const { issues } = await issuesOf(
      assertSourceEligible(
        pins,
        writeOf({
          trackIds: [],
          dynamicSource: { type: 'artist', artistId: 'missing' },
        }),
      ),
    );

    expect(issues).toEqual([
      expect.objectContaining({ reason: 'SOURCE_NOT_FOUND' }),
    ]);
  });

  it('carries a reason for a dynamic source with too few Tracks', async () => {
    const pins = pinsRepository();
    vi.mocked(pins.sourceExists).mockResolvedValue(true);
    vi.mocked(pins.findSourceTrackIds).mockResolvedValue(['t1']);

    const { issues } = await issuesOf(
      assertSourceEligible(
        pins,
        writeOf({
          trackIds: [],
          dynamicSource: { type: 'genre', genre: 'rock' },
        }),
      ),
    );

    expect(issues).toEqual([
      expect.objectContaining({ reason: 'SOURCE_INSUFFICIENT' }),
    ]);
  });
});
