import type { PublicProfile } from '@vozzify/contracts';

import { noteName } from '@/lib/music-notes';

/** The three public chips of a Profile banner, in display order. */
type ProfileChipKey = 'dailyTarget' | 'vocalRange' | 'mostSungArtist';

export type ProfileChip = {
  key: ProfileChipKey;
  label: string;
  value: string;
  /** Notes are set in the mono face, like every note on the site. */
  mono: boolean;
};

/**
 * The translated pieces the chips are made of. The banner and the preview
 * image both pass theirs, so the two always say the same thing.
 */
export type ProfileChipMessages = {
  label: (key: ProfileChipKey) => string;
  dailyTargetValue: (minutes: number) => string;
  vocalRangeValue: (lowest: string, highest: string) => string;
};

type ChipSource = Pick<
  PublicProfile,
  'dailyPracticeTargetSeconds' | 'vocalRange' | 'mostSungArtist'
>;

/**
 * The chips a Profile has something to show for, in order. A chip the User
 * has nothing for is `null` in the response and is left out here.
 */
export function profileChips(
  profile: ChipSource,
  messages: ProfileChipMessages,
): ProfileChip[] {
  const chips: ProfileChip[] = [];
  const { dailyPracticeTargetSeconds, vocalRange, mostSungArtist } = profile;
  if (dailyPracticeTargetSeconds !== null) {
    chips.push({
      key: 'dailyTarget',
      label: messages.label('dailyTarget'),
      value: messages.dailyTargetValue(dailyPracticeTargetSeconds / 60),
      mono: false,
    });
  }
  if (vocalRange !== null) {
    chips.push({
      key: 'vocalRange',
      label: messages.label('vocalRange'),
      value: messages.vocalRangeValue(
        noteName(vocalRange.lowest),
        noteName(vocalRange.highest),
      ),
      mono: true,
    });
  }
  if (mostSungArtist !== null) {
    chips.push({
      key: 'mostSungArtist',
      label: messages.label('mostSungArtist'),
      value: mostSungArtist.name,
      mono: false,
    });
  }
  return chips;
}
