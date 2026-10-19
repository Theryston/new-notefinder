import type { Database } from '../../src/database/database.js';
import { dailyPracticeStreaks } from '../../src/database/schema/daily-practice-streaks.js';
import { practiceAttempts } from '../../src/database/schema/practice-attempts.js';
import {
  trackContributionKind,
  trackContributions,
  trackContributors,
} from '../../src/database/schema/track-contributors.js';
import { trackProcessings } from '../../src/database/schema/track-processings.js';
import type { Track, User } from './factories.js';

/** A saved practice run of a User on a Track, valid unless overridden. */
export const createPracticeAttempt = async (
  db: Database,
  userId: string,
  trackId: string,
  overrides: Partial<typeof practiceAttempts.$inferInsert> = {},
): Promise<void> => {
  await db.insert(practiceAttempts).values({
    userId,
    trackId,
    difficulty: 'NORMAL',
    octaveMode: 'ANY',
    transposeSemitones: 0,
    speed: 1,
    accuracy: 0.9,
    coverage: 0.95,
    forwardSkip: false,
    bleedSuspected: false,
    startedAt: new Date('2026-01-01T10:00:00Z'),
    endedAt: new Date('2026-01-01T10:03:00Z'),
    ...overrides,
  });
};

/** A completed practice day of a User, as the streak credits it. */
export const createCompletedDay = async (
  db: Database,
  userId: string,
  day: string,
): Promise<void> => {
  await db.insert(dailyPracticeStreaks).values({
    userId,
    day,
    listenedSeconds: 300,
    completed: true,
    completedAt: new Date(`${day}T12:00:00Z`),
  });
};

/**
 * `count` Contributions of one User to one Track, each of `kind`, all made by
 * the same Contributor row (a User is a Contributor once per Track).
 */
export const createContributions = async (
  db: Database,
  options: {
    user: Pick<User, 'id'>;
    track: Pick<Track, 'id'>;
    count: number;
    kind?: (typeof trackContributionKind.enumValues)[number];
  },
): Promise<void> => {
  const { user, track, count, kind = 'CREATE' } = options;
  const [contributor] = await db
    .insert(trackContributors)
    .values({ trackId: track.id, userId: user.id })
    .returning();
  if (!contributor) {
    throw new Error('The contributor row was not inserted');
  }
  for (let index = 0; index < count; index += 1) {
    const [processing] = await db
      .insert(trackProcessings)
      .values({ trackId: track.id })
      .returning();
    if (!processing) {
      throw new Error('The processing row was not inserted');
    }
    await db.insert(trackContributions).values({
      contributorId: contributor.id,
      kind,
      processingId: processing.id,
    });
  }
};
