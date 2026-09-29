import { isUniqueViolation } from './unique-violation.js';

const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error('pg'), { code, constraint });

describe('isUniqueViolation', () => {
  it('recognizes a node-postgres unique violation', () => {
    expect(isUniqueViolation(pgError('23505', 'users_username_unique'))).toBe(
      true,
    );
  });

  it('finds it under the cause Drizzle wraps query errors in', () => {
    const wrapped = new Error('Failed query', {
      cause: pgError('23505', 'users_username_unique'),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('ignores other database errors', () => {
    expect(isUniqueViolation(pgError('23503', 'users_fk'))).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });

  it('ignores values that are not errors', () => {
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  describe('with a constraint', () => {
    it('matches only that constraint', () => {
      const error = pgError('23505', 'users_username_unique');
      expect(isUniqueViolation(error, 'users_username_unique')).toBe(true);
      expect(isUniqueViolation(error, 'users_email_unique')).toBe(false);
    });

    it('looks through the cause too', () => {
      const wrapped = new Error('Failed query', {
        cause: pgError('23505', 'users_email_unique'),
      });
      expect(isUniqueViolation(wrapped, 'users_email_unique')).toBe(true);
      expect(isUniqueViolation(wrapped, 'users_username_unique')).toBe(false);
    });
  });
});
