import { describe, expect, it } from 'vitest';

import { type ProfileChipMessages, profileChips } from './profile-chips';

const messages: ProfileChipMessages = {
  label: (key) => `label:${key}`,
  dailyTargetValue: (minutes) => `${minutes} min`,
  vocalRangeValue: (lowest, highest) => `${lowest}-${highest}`,
};

const banner = {
  dailyPracticeTargetSeconds: null,
  vocalRange: null,
  mostSungArtist: null,
};

describe('profileChips', () => {
  it('has no chips for a Profile with nothing to show', () => {
    expect(profileChips(banner, messages)).toEqual([]);
  });

  it('lists the chips a Profile has, in banner order, with their values', () => {
    const chips = profileChips(
      {
        dailyPracticeTargetSeconds: 900,
        vocalRange: { lowest: 48, highest: 74 },
        mostSungArtist: { id: 'artist-1', name: 'Queen' },
      },
      messages,
    );

    expect(chips).toEqual([
      {
        key: 'dailyTarget',
        label: 'label:dailyTarget',
        value: '15 min',
        mono: false,
      },
      {
        key: 'vocalRange',
        label: 'label:vocalRange',
        value: 'C3-D5',
        mono: true,
      },
      {
        key: 'mostSungArtist',
        label: 'label:mostSungArtist',
        value: 'Queen',
        mono: false,
      },
    ]);
  });

  it('leaves out only the chips that are null', () => {
    const chips = profileChips(
      { ...banner, mostSungArtist: { id: 'artist-2', name: 'Abba' } },
      messages,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['mostSungArtist']);
  });

  it('divides the Daily target by 60 before formatting it as minutes', () => {
    const chips = profileChips(
      { ...banner, dailyPracticeTargetSeconds: 300 },
      {
        ...messages,
        dailyTargetValue: (minutes) => `${minutes}`,
      },
    );

    expect(chips[0]?.value).toBe('5');
  });
});
