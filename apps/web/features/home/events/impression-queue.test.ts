import { describe, expect, it } from 'vitest';
import { HomeImpressionQueue } from './impression-queue';

const impression = (rowId: string) => ({
  rowId,
  feedVersion: 'a1b2c3d4e5f60718',
  algorithmVersion: 1,
  items: [{ id: 'track-1', position: 0 }],
});

describe('HomeImpressionQueue', () => {
  it('queues a row once per page load, ignoring later sightings', () => {
    const queue = new HomeImpressionQueue();

    expect(queue.record(impression('row-0'))).toBe(true);
    expect(queue.record(impression('row-0'))).toBe(false);
    expect(queue.record(impression('row-1'))).toBe(true);

    expect(queue.takeBatch().map((event) => event.rowId)).toEqual([
      'row-0',
      'row-1',
    ]);
  });

  it('keeps ignoring a row after its batch was flushed', () => {
    const queue = new HomeImpressionQueue();
    queue.record(impression('row-0'));
    queue.takeBatch();

    expect(queue.record(impression('row-0'))).toBe(false);
    expect(queue.isEmpty).toBe(true);
  });

  it('flushes in batches, leaving the queue empty', () => {
    const queue = new HomeImpressionQueue();
    expect(queue.isEmpty).toBe(true);

    queue.record(impression('row-0'));
    queue.record(impression('row-1'));
    expect(queue.isEmpty).toBe(false);

    const batch = queue.takeBatch();
    expect(batch).toHaveLength(2);
    expect(batch[0]).toMatchObject({
      type: 'home.row_impression',
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
    });
    expect(queue.isEmpty).toBe(true);
    expect(queue.takeBatch()).toEqual([]);
  });
});
