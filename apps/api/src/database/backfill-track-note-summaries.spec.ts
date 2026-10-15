import { backfillTrackNoteSummaries } from './backfill-track-note-summaries.js';
import type { Database } from './database.js';
import { tracks } from './schema/tracks.js';

/**
 * A Drizzle client that answers the backfill's selects in order (the Tracks
 * missing a summary, then each Track's notes) and records the updates.
 */
function fakeDatabase(answers: unknown[][]) {
  const queue = [...answers];
  const sets: unknown[] = [];
  const next = () => Promise.resolve(queue.shift() ?? []);
  // The pending Tracks are read with the first select (from `tracks`, with the
  // sub-select inside its `where`); a Track's notes with the next ones.
  const db = {
    select: () => ({
      from: (table: unknown) =>
        table === tracks
          ? { where: next }
          : { where: () => ({ orderBy: next }) },
    }),
    update: () => ({
      set: (values: unknown) => {
        sets.push(values);
        return { where: () => Promise.resolve() };
      },
    }),
    transaction: (run: (tx: unknown) => Promise<void>) => run(db),
  };
  return { db: db as unknown as Database, sets };
}

describe('backfillTrackNoteSummaries', () => {
  it('writes the summary of each Track that has notes and none', async () => {
    const { db, sets } = fakeDatabase([
      [{ id: 'track-1' }],
      [
        { pitch: 60, start: 0, end: 1 },
        { pitch: 67, start: 1, end: 2 },
      ],
    ]);

    await expect(backfillTrackNoteSummaries(db)).resolves.toBe(1);

    expect(sets).toEqual([
      expect.objectContaining({ vocalRangeLowest: 60, vocalRangeHighest: 67 }),
    ]);
  });

  it('does nothing when every Track has its summary', async () => {
    const { db, sets } = fakeDatabase([[]]);

    await expect(backfillTrackNoteSummaries(db)).resolves.toBe(0);

    expect(sets).toEqual([]);
  });
});
