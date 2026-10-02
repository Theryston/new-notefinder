import { sleepUnlessAborted } from './abortable-sleep.js';

describe('sleepUnlessAborted', () => {
  it('resolves after the delay', async () => {
    const signal = new AbortController().signal;

    await expect(sleepUnlessAborted(5, signal)).resolves.toBeUndefined();
  });

  it('resolves at once when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      sleepUnlessAborted(60_000, controller.signal),
    ).resolves.toBeUndefined();
  });

  it('wakes early when aborted mid-wait', async () => {
    const controller = new AbortController();
    const waiting = sleepUnlessAborted(60_000, controller.signal);
    controller.abort();

    await expect(waiting).resolves.toBeUndefined();
  });
});
