import type { Database } from '../../src/database/database.js';
import { LyricsRepository } from '../../src/modules/lyrics/lyrics.repository.js';
import { RecordingRepository } from '../../src/modules/recording/recording.repository.js';

/**
 * The Lyrics the import kept for a Recording, read straight from the given
 * database: `getRecording` no longer carries them. Fails when the Recording
 * itself is missing, so a null answer always means "no Lyrics matched", never
 * "nothing was imported".
 */
export const keptLyricsOf = async (
  db: Database,
  mbid: string,
): Promise<{ plain: string | null; synced: string | null }> => {
  const recording = await new RecordingRepository(db).findByMbid(mbid);
  if (recording === undefined) {
    throw new Error(`No Recording ${mbid} in the database`);
  }
  const row = await new LyricsRepository(db).findByMbid(mbid);
  return { plain: row?.plain ?? null, synced: row?.synced ?? null };
};
