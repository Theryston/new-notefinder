import bcrypt from 'bcryptjs';
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from './password.js';

const PASSWORD = 'correct horse battery staple';

describe('password', () => {
  describe('legacy bcrypt hashes', () => {
    // Legacy hashed with bcryptjs (cost 10); $2a$ came from bcryptjs 2.x,
    // $2b$ from 3.x. Same salt and digest for ASCII passwords.
    const hash2b = bcrypt.hashSync(PASSWORD, 4);
    const hash2a = hash2b.replace(/^\$2b\$/, '$2a$');

    it.each([
      ['$2a$', hash2a],
      ['$2b$', hash2b],
    ])('accepts the right password for a %s hash', async (_, hash) => {
      expect(isLegacyPasswordHash(hash)).toBe(true);
      await expect(verifyPassword({ hash, password: PASSWORD })).resolves.toBe(
        true,
      );
    });

    it('rejects a wrong password', async () => {
      await expect(
        verifyPassword({ hash: hash2b, password: 'wrong password' }),
      ).resolves.toBe(false);
    });
  });

  describe('scrypt hashes (Better Auth default)', () => {
    it('hashes new passwords with scrypt, never bcrypt', async () => {
      const hash = await hashPassword(PASSWORD);
      expect(isLegacyPasswordHash(hash)).toBe(false);
      expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(hash).not.toContain(PASSWORD);
    });

    it('accepts the right password', async () => {
      const hash = await hashPassword(PASSWORD);
      await expect(verifyPassword({ hash, password: PASSWORD })).resolves.toBe(
        true,
      );
    });

    it('rejects a wrong password', async () => {
      const hash = await hashPassword(PASSWORD);
      await expect(
        verifyPassword({ hash, password: `${PASSWORD}!` }),
      ).resolves.toBe(false);
    });

    it('salts every hash', async () => {
      expect(await hashPassword(PASSWORD)).not.toBe(
        await hashPassword(PASSWORD),
      );
    });
  });

  it.each([
    ['a scrypt hash', 'abc:def', false],
    ['a $2y$ hash', `$2y$10$${'a'.repeat(53)}`, true],
    ['an argon2 hash', '$argon2id$v=19$m=65536', false],
  ])('recognizes %s', (_, hash, expected) => {
    expect(isLegacyPasswordHash(hash)).toBe(expected);
  });
});
