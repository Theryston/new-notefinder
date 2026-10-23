import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { practiceAttempts } from '../../database/schema/practice-attempts.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';
import { users } from '../../database/schema/users.js';

type SocialProfileSignals = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  practiceTrackIds: string[];
  favoriteTrackIds: string[];
};

export type SocialSignals = {
  viewerPracticeTrackIds: string[];
  viewerFavoriteTrackIds: string[];
  profiles: SocialProfileSignals[];
};

type ProfileRecord = {
  id: string;
  username: string;
  name: string;
  image: string | null;
};

type TrackSignal = { userId: string; trackId: string };

const MAX_SOCIAL_PROFILES = 500;
const uniqueFor = (
  rows: { userId: string; trackId: string }[],
  userId: string,
) => [
  ...new Set(
    rows.filter((row) => row.userId === userId).map((row) => row.trackId),
  ),
];

/** Reads a bounded batch of public users' practice and favorite Track sets. */
@Injectable()
export class HomeSocialRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findSignals(viewerId: string): Promise<SocialSignals> {
    const profiles = await this.findProfiles(viewerId);
    const ids = [viewerId, ...profiles.map((profile) => profile.id)];
    const [practiceRows, favoriteRows] = await Promise.all([
      this.findPracticeTracks(ids),
      this.findFavoriteTracks(ids),
    ]);
    return {
      viewerPracticeTrackIds: uniqueFor(practiceRows, viewerId),
      viewerFavoriteTrackIds: uniqueFor(favoriteRows, viewerId),
      profiles: profiles.map((profile) => ({
        ...profile,
        practiceTrackIds: uniqueFor(practiceRows, profile.id),
        favoriteTrackIds: uniqueFor(favoriteRows, profile.id),
      })),
    };
  }

  private async findProfiles(viewerId: string): Promise<ProfileRecord[]> {
    const rows = await this.txHost.tx
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(and(isNotNull(users.username), sql`${users.id} <> ${viewerId}`))
      .orderBy(desc(users.updatedAt))
      .limit(MAX_SOCIAL_PROFILES);
    return rows.filter(
      (profile): profile is typeof profile & { username: string } =>
        profile.username !== null,
    );
  }

  private findPracticeTracks(ids: string[]): Promise<TrackSignal[]> {
    return this.txHost.tx
      .selectDistinct({
        userId: practiceAttempts.userId,
        trackId: practiceAttempts.trackId,
      })
      .from(practiceAttempts)
      .innerJoin(tracks, eq(tracks.id, practiceAttempts.trackId))
      .where(
        and(
          inArray(practiceAttempts.userId, ids),
          hasCompletedProcessing(practiceAttempts.trackId),
        ),
      );
  }

  private findFavoriteTracks(ids: string[]): Promise<TrackSignal[]> {
    return this.txHost.tx
      .selectDistinct({
        userId: trackFavorites.userId,
        trackId: trackFavorites.trackId,
      })
      .from(trackFavorites)
      .where(
        and(
          inArray(trackFavorites.userId, ids),
          hasCompletedProcessing(trackFavorites.trackId),
        ),
      );
  }
}
