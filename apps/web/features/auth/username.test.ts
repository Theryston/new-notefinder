import { usernameSchema } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { normalizeUsernameInput, suggestUsername } from './username';

describe('suggestUsername', () => {
  it('slugifies the name and appends a 4-digit number', () => {
    expect(suggestUsername('João da Silva', () => 0)).toBe(
      'joao_da_silva_1000',
    );
    expect(suggestUsername('Ada Lovelace', () => 0.999_99)).toBe(
      'ada_lovelace_9999',
    );
  });

  it('drops leading, trailing and repeated separators', () => {
    expect(suggestUsername('  --Ada!!  L. ', () => 0.5)).toBe('ada_l_5500');
  });

  it('falls back when the name has nothing usable', () => {
    expect(suggestUsername('李 ✨', () => 0)).toBe('singer_1000');
  });

  it('stays within the maximum length', () => {
    const username = suggestUsername('a'.repeat(80), () => 0);
    expect(username).toHaveLength(50);
    expect(username.endsWith('_1000')).toBe(true);
  });

  it('never ends the base with an underscore after cutting', () => {
    expect(suggestUsername(`${'a'.repeat(44)} b`, () => 0)).toBe(
      `${'a'.repeat(44)}_1000`,
    );
  });

  it('always passes the contract', () => {
    for (const name of ['Zé', 'a', '', 'Ünïcödé Nâme', 'x'.repeat(200)]) {
      expect(usernameSchema.safeParse(suggestUsername(name)).success).toBe(
        true,
      );
    }
  });
});

describe('normalizeUsernameInput', () => {
  it('lowercases and turns spaces into underscores', () => {
    expect(normalizeUsernameInput('Ada Love Lace')).toBe('ada_love_lace');
  });
});
