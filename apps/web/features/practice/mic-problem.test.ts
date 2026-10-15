import { describe, expect, it } from 'vitest';

import { micProblemOf } from './mic-problem';

describe('micProblemOf', () => {
  it.each(['NotAllowedError', 'SecurityError'])(
    'says %s is a permission problem the user can fix',
    (name) => {
      expect(micProblemOf({ name })).toBe('denied');
    },
  );

  it.each([
    'NotFoundError',
    'NotReadableError',
    'OverconstrainedError',
    'AbortError',
  ])('says %s is a mic the user cannot just allow', (name) => {
    expect(micProblemOf({ name })).toBe('unavailable');
  });

  it('says anything else is unavailable', () => {
    expect(micProblemOf(new Error('no getUserMedia'))).toBe('unavailable');
    expect(micProblemOf(undefined)).toBe('unavailable');
    expect(micProblemOf('boom')).toBe('unavailable');
  });
});
