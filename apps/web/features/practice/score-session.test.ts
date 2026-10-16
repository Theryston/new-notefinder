import { describe, expect, it } from 'vitest';
import { ScoreSession } from './score-session';

const notes = [
  { pitch: 60, start: 0, end: 1 },
  { pitch: 64, start: 1, end: 2 },
];

describe('practice run boundaries', () => {
  it('scores only an active run, finishes once and clears the result for a retry', () => {
    const session = new ScoreSession(notes);
    session.record(0.5, 60);
    expect(session.getSnapshot().summary.judged).toBe(0);
    session.begin();
    session.record(0.5, 60);
    session.finish();
    expect(session.getSnapshot().result).toMatchObject({
      accuracy: 1,
      judged: 1,
    });
    const finished = session.getSnapshot();
    session.finish();
    expect(session.getSnapshot()).toBe(finished);
    session.dismiss();
    expect(session.getSnapshot().result).toBeNull();
    session.begin();
    expect(session.getSnapshot().summary.judged).toBe(0);
  });

  it('changes difficulty and octave mode immediately without forgetting notes', () => {
    const session = new ScoreSession(notes);
    session.begin();
    session.record(0.5, 60.6);
    expect(session.getSnapshot().latest).toBe('near');
    session.setSettings({ difficulty: 'EASY', octaveMode: 'ANY' });
    expect(session.getSnapshot().latest).toBe('hit');
    session.record(1.5, 76);
    expect(session.getSnapshot().summary.accuracy).toBe(1);
    session.setSettings({ difficulty: 'EASY', octaveMode: 'EXACT' });
    expect(session.getSnapshot().summary).toMatchObject({
      accuracy: 0.5,
      judged: 2,
    });
    session.finish();
    session.setSettings({ difficulty: 'HARD', octaveMode: 'EXACT' });
    expect(session.getSnapshot().result?.accuracy).toBe(0);
  });

  it('keeps high-frequency identical feedback out of React snapshots', () => {
    const session = new ScoreSession(notes);
    session.begin();
    session.record(0.2, 60);
    const snapshot = session.getSnapshot();
    session.record(0.3, 60);
    expect(session.getSnapshot()).toBe(snapshot);
    session.seek(0.3, 1);
    session.finish();
    expect(session.getSnapshot().result?.forwardSkip).toBe(true);
  });

  it('scores a loop live and discards its result when stopped or disabled', () => {
    const session = new ScoreSession(notes);
    session.setLoop({ start: 1, end: 2 });
    session.begin();
    session.record(0.5, 60);
    expect(session.getSnapshot().summary.judged).toBe(0);
    session.record(1.5, 64);
    expect(session.getSnapshot().summary).toMatchObject({
      accuracy: 1,
      loop: true,
      submittable: false,
    });
    session.finish();
    expect(session.getSnapshot().result).toBeNull();
    session.setLoop(null);
    expect(session.getSnapshot().summary.judged).toBe(0);
    session.begin();
    session.record(0.5, 60);
    session.setLoop({ start: 1, end: 2 });
    expect(session.getSnapshot().summary.judged).toBe(0);
    session.record(1.5, 64);
    session.setLoop(null);
    expect(session.getSnapshot().summary.judged).toBe(0);
  });

  it('reports an empty run honestly and detaches observers', () => {
    const session = new ScoreSession(notes);
    let notifications = 0;
    const stop = session.subscribe(() => {
      notifications += 1;
    });
    session.begin();
    session.finish();
    expect(session.getSnapshot().result).toMatchObject({
      accuracy: 0,
      judged: 0,
    });
    const before = notifications;
    stop();
    session.begin();
    session.record(0.5, 60);
    expect(notifications).toBe(before);
  });
});

it('waits for a genuine resume after Stop even if the player keeps ticking before pause confirms', () => {
  const session = new ScoreSession(notes);
  session.synchronize(true, false);
  session.record(0.5, 60);
  session.finish();
  const finished = session.getSnapshot();
  session.synchronize(true, false);
  session.record(0.6, 64);
  expect(session.getSnapshot()).toBe(finished);
  session.synchronize(false, false);
  session.synchronize(true, false);
  expect(session.getSnapshot().result).toBeNull();
  expect(session.getSnapshot().summary.judged).toBe(0);
});

it('starts a fresh section score when the loop repeats', () => {
  const session = new ScoreSession(notes);
  session.setLoop({ start: 0, end: 2 });
  session.begin();
  session.record(0.5, 60);
  session.seek(2, 0);
  expect(session.getSnapshot().summary.judged).toBe(0);
  session.record(0.5, 62);
  expect(session.getSnapshot().latest).toBe('miss');
});
