import type {
  EditorialPinDynamicSource,
  EditorialPinKind,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import {
  DYNAMIC_ROW_MIN_TRACKS,
  type EditorialPinWrite,
  type SourceTrackQuery,
} from './editorial-pin-state.js';
import type { EditorialPinsRepository } from './editorial-pins.repository.js';

/**
 * Why a Track cannot appear in a pin, or `undefined` when it can: it must have
 * completed its Processing, and a hero also needs a cover.
 */
const refusalOf = (
  kind: EditorialPinWrite['kind'],
  track: { coverUrl: string | null } | undefined,
): string | undefined => {
  if (!track) {
    return 'The Track has not completed its Processing or does not exist';
  }
  if (kind === 'hero' && track.coverUrl === null) {
    return 'A hero needs a Track with a cover';
  }
  return undefined;
};

/** Tracks a dynamic source must offer for the pin to be accepted. */
const requiredTracksOf = (kind: EditorialPinKind): number =>
  kind === 'hero' ? 1 : DYNAMIC_ROW_MIN_TRACKS;

/** The query that reads a dynamic source for a pin of this kind. */
const sourceQueryOf = (
  kind: EditorialPinKind,
  limit: number,
): SourceTrackQuery => ({
  requireCover: kind === 'hero',
  limit,
});

const assertTracksEligible = async (
  pins: EditorialPinsRepository,
  write: EditorialPinWrite,
): Promise<void> => {
  const found = new Map(
    (await pins.findCompletedTracks(write.trackIds)).map(
      (track) => [track.id, track] as const,
    ),
  );
  const issues = write.trackIds.flatMap((trackId) => {
    const message = refusalOf(write.kind, found.get(trackId));
    return message === undefined
      ? []
      : [{ code: 'custom', path: ['source', 'trackIds'], message, trackId }];
  });
  if (issues.length > 0) {
    throw new AppException(
      'VALIDATION_FAILED',
      'Some Tracks cannot appear in this pin',
      { location: 'custom', issues },
    );
  }
};

/**
 * A genre, artist or album source must name something that exists and offer
 * enough eligible Tracks for the pin's kind.
 */
const assertDynamicSourceEligible = async (
  pins: EditorialPinsRepository,
  kind: EditorialPinKind,
  source: EditorialPinDynamicSource,
): Promise<void> => {
  if (!(await pins.sourceExists(source))) {
    throw new AppException(
      'VALIDATION_FAILED',
      `The ${source.type} does not exist`,
      {
        location: 'custom',
        issues: [
          {
            code: 'custom',
            path: ['source'],
            message: `The ${source.type} does not exist`,
          },
        ],
      },
    );
  }
  const required = requiredTracksOf(kind);
  const offered = await pins.findSourceTrackIds(
    source,
    sourceQueryOf(kind, required),
  );
  if (offered.length < required) {
    throw new AppException(
      'VALIDATION_FAILED',
      `The ${source.type} has fewer than ${required} eligible Tracks`,
      {
        location: 'custom',
        issues: [
          {
            code: 'custom',
            path: ['source'],
            message: `The ${source.type} has fewer than ${required} eligible Tracks`,
          },
        ],
      },
    );
  }
};

/**
 * A pin's source must offer enough eligible Tracks for the pin's kind: the
 * named Tracks of a `tracks` source, or the live Tracks of a genre, artist
 * or album source. A Track that later becomes ineligible is skipped at read
 * time, so this checks the source only when it is written.
 */
export const assertSourceEligible = async (
  pins: EditorialPinsRepository,
  write: EditorialPinWrite,
): Promise<void> => {
  if (write.dynamicSource) {
    await assertDynamicSourceEligible(pins, write.kind, write.dynamicSource);
    return;
  }
  await assertTracksEligible(pins, write);
};
