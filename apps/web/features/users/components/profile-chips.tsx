import type { PublicProfile } from '@notefinder/contracts';

import { cn } from '@/lib/utils';

import { profileChipCopy } from '../profile-chip-copy';
import { type ProfileChip, profileChips } from '../profile-chips';

/**
 * The public chips under a Profile banner's info lines: the Daily target, the
 * Vocal range (mono, like every note) and the Most sung artist. With none of
 * them the list is not rendered at all.
 */
export async function ProfileChips({ profile }: { profile: PublicProfile }) {
  const { highlightsLabel, messages } = await profileChipCopy();
  const chips = profileChips(profile, messages);
  if (chips.length === 0) {
    return null;
  }

  return (
    <ul aria-label={highlightsLabel} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <ChipPill key={chip.key} chip={chip} />
      ))}
    </ul>
  );
}

/**
 * One outlined pill (the header chips of DESIGN.md "Featured blocks"): the
 * label, then the value. Long values break inside the pill, so a 360px screen
 * wraps them instead of overflowing.
 */
function ChipPill({ chip }: { chip: ProfileChip }) {
  return (
    <li className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-full border border-primary-foreground/40 px-3 py-1 text-xs">
      <span className="font-semibold">{chip.label}</span>
      <span
        className={cn(
          'min-w-0 break-words font-semibold',
          chip.mono && 'font-mono tabular-nums',
        )}
      >
        {chip.value}
      </span>
    </li>
  );
}
