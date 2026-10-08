import { CatalogError } from '../../errors/catalog-error.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { ReleaseGroupRepository } from './release-group.repository.js';
import { ReleaseGroupService } from './release-group.service.js';
import type {
  ReleaseGroupRow,
  ReleaseWithEvents,
} from './release-group-data.js';

const MBID = '00000000-0000-4000-8000-000000000300';
const OLD_MBID = '00000000-0000-4000-8000-000000000301';
const OFFICIAL_RELEASE = '00000000-0000-4000-8000-000000000200';
const BOOTLEG_RELEASE = '00000000-0000-4000-8000-000000000201';

const row: ReleaseGroupRow = {
  id: 7,
  mbid: MBID,
  title: 'A Night at the Opera',
  primaryType: 'Album',
  artistCreditId: 3,
  artistCreditName: 'Queen',
};

const officialRelease: ReleaseWithEvents = {
  id: 11,
  mbid: OFFICIAL_RELEASE,
  title: 'A Night at the Opera',
  status: 'Official',
  events: [{ year: 1975, month: 11, day: 21 }],
};

const bootlegRelease: ReleaseWithEvents = {
  id: 12,
  mbid: BOOTLEG_RELEASE,
  title: 'A Night at the Opera (bootleg)',
  status: 'Bootleg',
  events: [{ year: 1974, month: null, day: null }],
};

const setup = (
  overrides: Partial<Record<keyof ReleaseGroupRepository, unknown>> = {},
) => {
  const repository = {
    findByMbid: vi.fn(async () => row),
    findMergedInto: vi.fn(async () => undefined),
    findCreditedArtists: vi.fn(async () => []),
    findSecondaryTypes: vi.fn(async () => []),
    findTagVotes: vi.fn(async () => []),
    findReleases: vi.fn(async () => [officialRelease, bootlegRelease]),
    findMedia: vi.fn(async () => []),
    ...overrides,
  };
  const bootstrap = { assertReady: vi.fn(async () => undefined) };
  const service = new ReleaseGroupService(
    repository as unknown as ReleaseGroupRepository,
    bootstrap as unknown as BootstrapService,
  );
  return { service, repository, bootstrap };
};

describe('ReleaseGroupService', () => {
  it('waits for the catalog to be ready before reading anything', async () => {
    const { service, repository, bootstrap } = setup();
    const notReady = new CatalogError('CATALOG_NOT_READY', 'Not ready');
    bootstrap.assertReady.mockRejectedValueOnce(notReady);

    await expect(service.getReleaseGroup(MBID)).rejects.toBe(notReady);
    expect(repository.findByMbid).not.toHaveBeenCalled();
  });

  it('answers RELEASE_GROUP_NOT_FOUND for an MBID it does not know', async () => {
    const { service } = setup({ findByMbid: vi.fn(async () => undefined) });

    await expect(service.getReleaseGroup(MBID)).rejects.toMatchObject({
      code: 'RELEASE_GROUP_NOT_FOUND',
    });
  });

  it('answers RELEASE_GROUP_MOVED with the new MBID for a merged release group', async () => {
    const { service } = setup({
      findByMbid: vi.fn(async () => undefined),
      findMergedInto: vi.fn(async () => MBID),
    });

    await expect(service.getReleaseGroup(OLD_MBID)).rejects.toMatchObject({
      code: 'RELEASE_GROUP_MOVED',
      newMbid: MBID,
    });
  });

  it('reads the media of the Official release only, the representative one', async () => {
    const { service, repository } = setup();

    const result = await service.getReleaseGroup(MBID);

    expect(repository.findMedia).toHaveBeenCalledExactlyOnceWith(
      officialRelease.id,
    );
    expect(result.representativeRelease?.mbid).toBe(OFFICIAL_RELEASE);
  });

  it('falls back to the earliest release of any status when none is Official', async () => {
    const { service, repository } = setup({
      findReleases: vi.fn(async () => [bootlegRelease]),
    });

    const result = await service.getReleaseGroup(MBID);

    expect(repository.findMedia).toHaveBeenCalledExactlyOnceWith(
      bootlegRelease.id,
    );
    expect(result.representativeRelease?.mbid).toBe(BOOTLEG_RELEASE);
    expect(result.firstReleaseYear).toBe(1974);
  });

  it('answers no representative release only when the group has no releases', async () => {
    const { service, repository } = setup({
      findReleases: vi.fn(async () => []),
    });

    const result = await service.getReleaseGroup(MBID);

    expect(repository.findMedia).not.toHaveBeenCalled();
    expect(result.representativeRelease).toBeNull();
    expect(result.firstReleaseYear).toBeNull();
  });
});
