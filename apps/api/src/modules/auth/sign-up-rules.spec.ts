import { NAME_MAX_LENGTH } from '@notefinder/contracts';
import { APIError } from 'better-auth/api';
import { enforceSignUpRules, validateSignUpBody } from './sign-up-rules.js';

const VALID_BODY = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'analytical-engine-1843',
};

const errorOf = (body: unknown): APIError => {
  try {
    validateSignUpBody(body);
  } catch (error) {
    if (error instanceof APIError) return error;
    throw error;
  }
  throw new Error('expected the sign-up body to be refused');
};

describe('validateSignUpBody', () => {
  it('returns the Name of a valid body', () => {
    expect(validateSignUpBody(VALID_BODY)).toEqual({ name: 'Ada Lovelace' });
  });

  it('trims the Name', () => {
    expect(validateSignUpBody({ ...VALID_BODY, name: '  Ada  ' })).toEqual({
      name: 'Ada',
    });
  });

  it('accepts a Name of exactly the limit, spaces around it aside', () => {
    const name = 'a'.repeat(NAME_MAX_LENGTH);
    expect(validateSignUpBody({ ...VALID_BODY, name: ` ${name} ` })).toEqual({
      name,
    });
  });

  describe.each([
    ['empty', ''],
    ['blank', '   '],
    ['too long', 'a'.repeat(NAME_MAX_LENGTH + 1)],
    ['null', null],
    ['a number', 42],
    ['missing', undefined],
  ])('a Name that is %s', (_label, name) => {
    it('is refused as INVALID_NAME', () => {
      const error = errorOf({ ...VALID_BODY, name });

      expect(error.statusCode).toBe(400);
      expect(error.body).toMatchObject({
        code: 'INVALID_NAME',
        message: `The name must have 1 to ${NAME_MAX_LENGTH} characters`,
      });
    });
  });

  it.each([
    ['not there', undefined],
    ['a string', 'ada'],
    ['an array', []],
    ['null', null],
  ])('refuses a body that is %s as INVALID_NAME', (_label, body) => {
    expect(errorOf(body).body).toMatchObject({ code: 'INVALID_NAME' });
  });

  describe.each([
    ['an external URL', 'https://evil.example/avatar.png'],
    ['an empty string', ''],
    ['null', null],
    ['a number', 1],
  ])('an image that is %s', (_label, image) => {
    it('is refused as IMAGE_NOT_ALLOWED, even with a valid Name', () => {
      const error = errorOf({ ...VALID_BODY, image });

      expect(error.statusCode).toBe(400);
      expect(error.body).toMatchObject({
        code: 'IMAGE_NOT_ALLOWED',
        message: 'An avatar cannot be set on sign-up',
      });
    });
  });

  it('refuses the image before looking at the Name', () => {
    const error = errorOf({ name: '', image: 'https://evil.example/a.png' });

    expect(error.body).toMatchObject({ code: 'IMAGE_NOT_ALLOWED' });
  });
});

describe('enforceSignUpRules', () => {
  const run = (path: string, body: unknown) =>
    enforceSignUpRules({ path, body } as never);

  it('hands the trimmed Name to the sign-up endpoint', async () => {
    await expect(
      run('/sign-up/email', { ...VALID_BODY, name: ' Ada ' }),
    ).resolves.toEqual({ context: { body: { name: 'Ada' } } });
  });

  it('refuses a sign-up with an image', async () => {
    await expect(
      run('/sign-up/email', { ...VALID_BODY, image: 'https://x.example/a' }),
    ).rejects.toMatchObject({ body: { code: 'IMAGE_NOT_ALLOWED' } });
  });

  it.each([
    '/sign-in/email',
    '/sign-in/social',
    '/callback/google',
    '/email-otp/verify-email',
  ])('leaves %s alone, whatever its body', async (path) => {
    await expect(
      run(path, { image: 'https://x.example/a', name: '' }),
    ).resolves.toBeUndefined();
  });
});
