import { AppException } from '../../common/errors/app-exception.js';
import type { TracksRepository } from './tracks.repository.js';

/**
 * The answer for an ID that found no Track: `RESOURCE_MOVED` with the new ID
 * for a legacy ID, else `NOT_FOUND`. The one place this rule lives; the caller
 * must have proved the Track is missing.
 */
export async function throwMovedOrMissing(
  tracks: Pick<TracksRepository, 'findTrackIdByLegacyId'>,
  trackId: string,
): Promise<never> {
  const newId = await tracks.findTrackIdByLegacyId(trackId);
  if (newId !== undefined) {
    throw new AppException('RESOURCE_MOVED', 'Track moved', { id: newId });
  }
  throw new AppException('NOT_FOUND', 'Track not found');
}
