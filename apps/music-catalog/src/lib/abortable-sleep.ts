/**
 * Resolves after `ms`, or as soon as `signal` aborts, so loops wait between
 * rounds without delaying a shutdown. Never rejects.
 */
export const sleepUnlessAborted = (
  ms: number,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const wake = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', wake);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    signal.addEventListener('abort', wake);
  });
