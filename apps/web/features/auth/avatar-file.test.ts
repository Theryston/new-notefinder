import { AVATAR_MAX_BYTES } from '@notefinder/contracts/avatar-rules';
import { describe, expect, it } from 'vitest';

import {
  AVATAR_ACCEPT,
  AVATAR_MAX_MEGABYTES,
  avatarFileProblem,
} from './avatar-file';

describe('avatarFileProblem', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])(
    'accepts a small %s',
    (type) => {
      expect(avatarFileProblem({ type, size: 1024 })).toBeNull();
    },
  );

  it.each([
    'image/gif',
    'image/svg+xml',
    'image/heic',
    'application/pdf',
    'text/plain',
    '',
  ])('refuses the type "%s"', (type) => {
    expect(avatarFileProblem({ type, size: 1024 })).toBe('unsupportedType');
  });

  it('accepts a file of exactly the size limit', () => {
    const file = { type: 'image/png', size: AVATAR_MAX_BYTES };

    expect(avatarFileProblem(file)).toBeNull();
  });

  it('refuses a file one byte over the size limit', () => {
    const file = { type: 'image/png', size: AVATAR_MAX_BYTES + 1 };

    expect(avatarFileProblem(file)).toBe('tooLarge');
  });

  it('reports the type before the size', () => {
    const file = { type: 'image/gif', size: AVATAR_MAX_BYTES + 1 };

    expect(avatarFileProblem(file)).toBe('unsupportedType');
  });
});

describe('what the picker offers', () => {
  it('accepts exactly the types the file check accepts', () => {
    expect(AVATAR_ACCEPT).toBe('image/png,image/jpeg,image/webp');
  });

  it('names the limit in megabytes', () => {
    expect(AVATAR_MAX_MEGABYTES).toBe(5);
  });
});
