import { describe, expect, it, vi } from 'vitest';

import { ScoreSession } from './score-session';

const notes = [{ pitch: 60, start: 0, end: 1 }];

/** The wall-clock window of a run, for the attempt the page saves. */
describe('ScoreSession run window', () => {
  it('is null until the first finish', () => {
    const session = new ScoreSession(notes);

    expect(session.runWindow()).toBeNull();
    session.begin();
    expect(session.runWindow()).toBeNull();
  });

  it('covers the finished run and resets on the next one', () => {
    const session = new ScoreSession(notes);
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
    session.begin();
    vi.setSystemTime(new Date('2026-10-16T10:04:00.000Z'));
    session.finish();

    expect(session.runWindow()).toEqual({
      startedAt: new Date('2026-10-16T10:00:00.000Z').getTime(),
      endedAt: new Date('2026-10-16T10:04:00.000Z').getTime(),
    });

    session.begin();
    expect(session.runWindow()).toBeNull();
    vi.useRealTimers();
  });
});
