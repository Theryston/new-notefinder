import { describe, expect, it } from 'vitest';

import type { ProfileChipMessages } from '../profile-chips';
import { profileOgCard, truncateText } from './profile-og-card';
import type { ProfileOgSource } from './profile-og-source';

const messages: ProfileChipMessages = {
  label: (key) => `label:${key}`,
  dailyTargetValue: (minutes) => `${minutes} min`,
  vocalRangeValue: (lowest, highest) => `${lowest}-${highest}`,
};

const source: ProfileOgSource = {
  username: 'ada_lovelace',
  name: 'Ada Lovelace',
  image: null,
  dailyPracticeTargetSeconds: null,
  vocalRange: null,
  mostSungArtist: null,
};

describe('profileOgCard', () => {
  it('draws the initials and the username of a Profile without an Avatar', () => {
    expect(
      profileOgCard({
        source,
        messages,
        avatar: undefined,
        initials: 'AL',
      }),
    ).toEqual({
      name: 'Ada Lovelace',
      username: 'ada_lovelace',
      initials: 'AL',
      avatar: undefined,
      chips: [],
    });
  });

  it('carries the Avatar it was given and the chips of the banner', () => {
    const card = profileOgCard({
      source: {
        ...source,
        dailyPracticeTargetSeconds: 300,
        mostSungArtist: { id: 'artist-1', name: 'Queen' },
      },
      messages,
      avatar: 'data:image/png;base64,AAAA',
      initials: 'AL',
    });

    expect(card.avatar).toBe('data:image/png;base64,AAAA');
    expect(card.chips.map((chip) => [chip.key, chip.value])).toEqual([
      ['dailyTarget', '5 min'],
      ['mostSungArtist', 'Queen'],
    ]);
  });

  it('shortens a long name in the card', () => {
    const card = profileOgCard({
      source: { ...source, name: 'a'.repeat(80) },
      messages,
      avatar: undefined,
      initials: 'AA',
    });

    expect([...card.name]).toHaveLength(60);
  });

  it('shortens a long chip value, so it stays clear of the Avatar', () => {
    const card = profileOgCard({
      source: {
        ...source,
        mostSungArtist: { id: 'artist-1', name: 'b'.repeat(80) },
      },
      messages,
      avatar: undefined,
      initials: 'AA',
    });

    expect([...(card.chips[0]?.value ?? '')]).toHaveLength(32);
  });
});

describe('truncateText', () => {
  it('keeps a text that fits as it is', () => {
    expect(truncateText('Ada Lovelace', 60)).toBe('Ada Lovelace');
  });

  it('cuts a text to the limit, ending with an ellipsis', () => {
    const truncated = truncateText('a'.repeat(80), 60);

    expect([...truncated]).toHaveLength(60);
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('cuts by code point, so an emoji is never split in half', () => {
    const text = '🎤'.repeat(61);

    expect(truncateText(text, 60)).toBe(`${'🎤'.repeat(59)}…`);
  });
});
