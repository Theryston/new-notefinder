const UNIQUE_VIOLATION = '23505';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Whether `error` is a Postgres unique-constraint violation, optionally on
 * one named constraint. Drizzle wraps the driver error as the `cause` of its
 * own, so the whole chain is searched.
 */
export const isUniqueViolation = (
  error: unknown,
  constraint?: string,
): boolean => {
  let current: unknown = error;
  while (isRecord(current)) {
    if (
      current.code === UNIQUE_VIOLATION &&
      (constraint === undefined || current.constraint === constraint)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
};
