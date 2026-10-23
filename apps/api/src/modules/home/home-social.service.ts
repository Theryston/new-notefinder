import { Injectable } from '@nestjs/common';
import type { HomePeopleRow } from '@notefinder/contracts';
import { AttemptsProfileService } from '../attempts/attempts-profile.service.js';
import { ProfileVisibilityService } from '../users/profile-visibility.service.js';
import { HomeSocialRepository } from './home-social.repository.js';
import { HomeSocialStore, type StoredSocialPair } from './home-social.store.js';
import {
  buildSocialRows,
  type SocialCandidate,
} from './home-social-similarity.js';

const union = (...sets: string[][]): Set<string> => new Set(sets.flat());

const overlapCount = (viewerTracks: Set<string>, targetTracks: Set<string>) =>
  [...targetTracks].filter((trackId) => viewerTracks.has(trackId)).length;

const distanceOf = (
  viewer: { lowest: number; highest: number } | null,
  candidate: { lowest: number; highest: number } | null,
): number | null =>
  viewer === null || candidate === null
    ? null
    : Math.abs(viewer.lowest - candidate.lowest) +
      Math.abs(viewer.highest - candidate.highest);

/** Refreshes batch-owned similarities and serves them through live visibility. */
@Injectable()
export class HomeSocialService {
  constructor(
    private readonly repository: HomeSocialRepository,
    private readonly visibility: ProfileVisibilityService,
    private readonly store: HomeSocialStore,
    private readonly attempts: AttemptsProfileService,
  ) {}

  /** Runs in the personal-feed worker, never in an HTTP request. */
  async refreshFor(viewerId: string): Promise<void> {
    const signals = await this.repository.findSignals(viewerId);
    const userIds = [
      viewerId,
      ...signals.profiles.map((profile) => profile.id),
    ];
    const ranges = await this.attempts.vocalRangesForUsers(userIds);
    const viewerTracks = union(
      signals.viewerPracticeTrackIds,
      signals.viewerFavoriteTrackIds,
    );
    const pairs = signals.profiles.map((profile): StoredSocialPair => {
      const practices = new Set(profile.practiceTrackIds);
      const favorites = new Set(profile.favoriteTrackIds);
      const both = new Set(
        [...practices].filter((trackId) => favorites.has(trackId)),
      );
      return {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        image: profile.image,
        practiceCommonTracks: overlapCount(viewerTracks, practices),
        favoriteCommonTracks: overlapCount(viewerTracks, favorites),
        bothCommonTracks: overlapCount(viewerTracks, both),
        vocalDistance: distanceOf(
          ranges.get(viewerId) ?? null,
          ranges.get(profile.id) ?? null,
        ),
      };
    });
    await this.store.write(viewerId, pairs);
  }

  /** Rechecks privacy and applies stored overlaps without recalculating pairs. */
  async rowsFor(viewerId: string): Promise<HomePeopleRow[]> {
    const pairs = await this.store.read(viewerId);
    if (!pairs || pairs.length === 0) return [];
    const visibility = await this.visibility.getShownSectionsByUserIds(
      pairs.map((pair) => pair.id),
    );
    return buildSocialRows(this.visibleCandidates(pairs, visibility));
  }

  private visibleCandidates(
    pairs: StoredSocialPair[],
    visibility: Map<
      string,
      {
        username: string | null;
        shown: {
          practiceHistory: boolean;
          favorites: boolean;
          summary: boolean;
        };
      }
    >,
  ): SocialCandidate[] {
    return pairs.flatMap((pair) => {
      const shown = visibility.get(pair.id);
      if (
        !shown ||
        shown.username === null ||
        (!shown.shown.practiceHistory && !shown.shown.favorites)
      ) {
        return [];
      }
      const commonTracks =
        (shown.shown.practiceHistory ? pair.practiceCommonTracks : 0) +
        (shown.shown.favorites ? pair.favoriteCommonTracks : 0) -
        (shown.shown.practiceHistory && shown.shown.favorites
          ? pair.bothCommonTracks
          : 0);
      return [
        {
          id: pair.id,
          username: shown.username,
          name: pair.name,
          image: pair.image,
          commonTracks,
          vocalDistance: pair.vocalDistance,
        },
      ];
    });
  }
}
