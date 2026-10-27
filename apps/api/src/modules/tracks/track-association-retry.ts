const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 10 * 60 * 1_000;

/** Caps durable outbox retries so long outages do not create hot polling. */
export const trackAssociationRetryDelay = (attempt: number): number =>
  Math.min(
    INITIAL_RETRY_DELAY_MS * 2 ** Math.min(Math.max(attempt - 1, 0), 7),
    MAX_RETRY_DELAY_MS,
  );
