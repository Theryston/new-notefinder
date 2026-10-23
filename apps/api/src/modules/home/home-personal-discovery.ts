import type {
  HomeCarouselRow,
  HomeHero,
  HomeRow,
  HomeTrack,
} from '@notefinder/contracts';
import { composeHomeRows } from './home-feed-composer.js';
import type { PersonalTaste } from './home-personal.js';
import {
  blendDiscoveryCandidates,
  byBlendedDesc,
  type DiscoveryCandidate,
  type DiscoveryTrack,
} from './home-personal-blend.js';
import { personalTrackPool } from './home-personal-voice.js';

/** Ranks the public Track pool by its blended score and drops mastered songs. */
export const blendedDiscoveryPool = (options: {
  publicRows: HomeRow[];
  discovery: ReadonlyMap<string, DiscoveryTrack>;
  taste: PersonalTaste;
  lambda: number;
  masteredTrackIds: ReadonlySet<string>;
}): DiscoveryCandidate[] => {
  const { publicRows, discovery, taste, lambda, masteredTrackIds } = options;
  return blendDiscoveryCandidates({
    tracks: personalTrackPool(publicRows),
    discovery,
    taste,
    lambda,
  })
    .filter((candidate) => !masteredTrackIds.has(candidate.track.id))
    .sort(byBlendedDesc);
};

const discoveryHeroRow = (
  sorted: DiscoveryCandidate[],
): HomeHero | undefined => {
  const heroTrack = sorted.find((candidate) => candidate.hasCover)?.track;
  return heroTrack
    ? { id: 'hero', layout: 'hero', track: heroTrack }
    : undefined;
};

const discoveryStandardRows = (
  publicRows: HomeRow[],
  sorted: DiscoveryCandidate[],
  masteredTrackIds: ReadonlySet<string>,
  alreadyUsedTrackIds: ReadonlySet<string>,
): HomeCarouselRow[] => {
  const heroId = sorted.find((candidate) => candidate.hasCover)?.track.id;
  const blended = new Map(
    sorted.map((candidate) => [candidate.track.id, candidate]),
  );
  const rows: HomeCarouselRow[] = [];
  for (const row of publicRows) {
    if (row.layout !== 'standard') {
      continue;
    }
    const [composed] = composeHomeRows([
      {
        id: row.id,
        layout: 'standard' as const,
        title: row.title,
        items: row.items
          .map((track) => blended.get(track.id))
          .filter(
            (candidate): candidate is DiscoveryCandidate =>
              candidate !== undefined &&
              candidate.track.id !== heroId &&
              !alreadyUsedTrackIds.has(candidate.track.id) &&
              !masteredTrackIds.has(candidate.track.id),
          )
          .sort(byBlendedDesc)
          .map((candidate) => ({
            id: candidate.track.id,
            artistKey: candidate.artistKey,
            hasCover: candidate.hasCover,
            isCompleted: true,
          })),
      },
    ]);
    if (!composed?.title) {
      continue;
    }
    const itemsById = new Map(row.items.map((track) => [track.id, track]));
    rows.push({
      id: composed.id,
      layout: 'standard',
      title: composed.title,
      items: composed.items.map((item) => {
        const track: HomeTrack | undefined = itemsById.get(item.id);
        if (!track) {
          throw new Error(`Discovery row lost Track ${item.id}`);
        }
        return track;
      }),
    });
  }
  return rows;
};

/** Builds the blended hero and standard rows after personal rows took their Tracks. */
export const buildPersonalDiscoveryRows = (options: {
  publicRows: HomeRow[];
  sorted: DiscoveryCandidate[];
  masteredTrackIds: ReadonlySet<string>;
  alreadyUsedTrackIds: ReadonlySet<string>;
}): HomeRow[] => {
  const { publicRows, sorted, masteredTrackIds, alreadyUsedTrackIds } = options;
  const eligible = sorted.filter(
    (candidate) => !alreadyUsedTrackIds.has(candidate.track.id),
  );
  const hero = discoveryHeroRow(eligible);
  return [
    ...(hero ? [hero] : []),
    ...discoveryStandardRows(
      publicRows,
      eligible,
      masteredTrackIds,
      alreadyUsedTrackIds,
    ),
  ];
};
