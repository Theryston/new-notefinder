import type { PublicProfile } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import {
  followButtonClasses,
  followCountsOf,
  followersAfter,
} from './follow-state';

describe('followButtonClasses', () => {
  it('gives the Unfollow label its own white on an outlined white edge, not the banner white on white', () => {
    const classes = followButtonClasses(true).split(' ');

    expect(classes).toContain('text-primary-foreground');
    expect(classes).toContain('border-primary-foreground/40');
    expect(classes).toContain('bg-transparent');
  });

  it('gives the Follow button a white fill with the orange label', () => {
    const classes = followButtonClasses(false).split(' ');

    expect(classes).toContain('bg-background');
    expect(classes).toContain('text-primary');
  });
});

describe('followersAfter', () => {
  it('adds one follower when the viewer starts following', () => {
    expect(followersAfter(4, false, true)).toBe(5);
  });

  it('removes one follower when the viewer stops following', () => {
    expect(followersAfter(4, true, false)).toBe(3);
  });

  it('changes nothing when the follow state stays the same', () => {
    expect(followersAfter(4, true, true)).toBe(4);
    expect(followersAfter(4, false, false)).toBe(4);
  });

  it('never goes below zero', () => {
    expect(followersAfter(0, true, false)).toBe(0);
  });
});

describe('followCountsOf', () => {
  it('keeps only the three follow numbers of the banner', () => {
    const profile = {
      username: 'ada',
      name: 'Ada',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
      dailyPracticeTargetSeconds: null,
      vocalRange: null,
      mostSungArtist: null,
      followersCount: 3,
      followingCount: 2,
      friendsCount: 1,
    } satisfies PublicProfile;

    expect(followCountsOf(profile)).toEqual({
      followersCount: 3,
      followingCount: 2,
      friendsCount: 1,
    });
  });
});
