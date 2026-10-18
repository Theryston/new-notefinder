import { describe, expect, it } from 'vitest';

import { resultAction } from './search-result-action';

const signedIn = { username: 'ada' };
const withoutUsername = { username: null };

describe('resultAction', () => {
  it('links a Recording that has a Track, whoever is looking', () => {
    expect(resultAction({ trackId: 'track-1' }, signedIn)).toBe('link');
    expect(resultAction({ trackId: 'track-1' }, null)).toBe('link');
    expect(resultAction({ trackId: 'track-1' }, withoutUsername)).toBe('link');
  });

  it('requests the notes for a signed-in visitor with a username', () => {
    expect(resultAction({ trackId: null }, signedIn)).toBe('request');
  });

  it('sends a signed-out visitor to sign in first', () => {
    expect(resultAction({ trackId: null }, null)).toBe('sign-in');
  });

  it('keeps a static row while the username is still missing', () => {
    expect(resultAction({ trackId: null }, withoutUsername)).toBe('static');
  });
});
