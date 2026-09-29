import {
  signUpBodySchema,
  type UpdateMeBody,
  updateMeBodySchema,
} from '@notefinder/contracts';
import { NAME_MAX_LENGTH } from '@notefinder/contracts/auth-rules';
import { describe, expect, it } from 'vitest';

// Sign-up and edit profile share one Name rule (`nameSchema`); each form
// validates with its own contract schema, so both are checked here.
const signUp = (name: string) =>
  signUpBodySchema.safeParse({
    name,
    email: 'ada@example.com',
    password: 'analytical-1843',
  });
const editProfile = (name: string) => updateMeBodySchema.safeParse({ name });

describe.each([
  ['sign-up', signUp],
  ['edit profile', editProfile],
])('the Name on %s', (_form, parse) => {
  it('is trimmed', () => {
    const result = parse('  Ada Lovelace  ');

    expect(result.data).toMatchObject({ name: 'Ada Lovelace' });
  });

  it('may not be empty or blank', () => {
    for (const name of ['', '   ']) {
      const result = parse(name);

      expect(result.error?.issues[0]?.code).toBe('too_small');
    }
  });

  it('may be as long as the limit, but not longer', () => {
    expect(parse('a'.repeat(NAME_MAX_LENGTH)).success).toBe(true);

    const tooLong = parse('a'.repeat(NAME_MAX_LENGTH + 1));

    expect(tooLong.error?.issues[0]?.code).toBe('too_big');
  });

  it('counts the length after trimming', () => {
    const padded = ` ${'a'.repeat(NAME_MAX_LENGTH)} `;

    expect(parse(padded).success).toBe(true);
  });
});

describe('the edit profile body', () => {
  it('has only the Name (the Username never changes here)', () => {
    const body: UpdateMeBody = updateMeBodySchema.parse({
      name: 'Ada',
      username: 'other',
      role: 'ADMIN',
    });

    expect(body).toEqual({ name: 'Ada' });
  });
});
