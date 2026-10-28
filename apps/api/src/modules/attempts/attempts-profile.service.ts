import { Injectable } from '@nestjs/common';
import type { TrackVocalRange } from '@vozzify/contracts';
import { AttemptsRepository } from './attempts.repository.js';
import { deriveVocalRange, type VocalRangeGroup } from './profile-chips.js';

/** Shared read of the Profile chips whose inputs are needed by batch generators. */
@Injectable()
export class AttemptsProfileService {
  constructor(private readonly attempts: AttemptsRepository) {}

  async vocalRangesForUsers(
    userIds: string[],
  ): Promise<Map<string, TrackVocalRange | null>> {
    const grouped = new Map<string, VocalRangeGroup[]>();
    for (const row of await this.attempts.listVocalRangeGroupsByUserIds(
      userIds,
    )) {
      const groups = grouped.get(row.userId) ?? [];
      groups.push({
        trackVocalRange:
          row.trackVocalRangeLowest === null ||
          row.trackVocalRangeHighest === null
            ? null
            : {
                lowest: row.trackVocalRangeLowest,
                highest: row.trackVocalRangeHighest,
              },
        transposeSemitones: row.transposeSemitones,
        forwardSkip: row.forwardSkip,
        bleedSuspected: row.bleedSuspected,
        bestAccuracy: row.bestAccuracy,
      });
      grouped.set(row.userId, groups);
    }
    return new Map(
      userIds.map((userId) => [
        userId,
        deriveVocalRange(grouped.get(userId) ?? []),
      ]),
    );
  }
}
