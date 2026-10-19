import type { PublicProfile } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';
import { noteName } from '@/lib/music-notes';
import { cn } from '@/lib/utils';

/**
 * The public chips under a Profile banner's info lines: the Daily target, the
 * Vocal range (mono, like every note) and the Most sung artist. A chip the
 * User has nothing for is absent from the response, so it is left out here,
 * and with none of them the list is not rendered at all.
 */
export async function ProfileChips({ profile }: { profile: PublicProfile }) {
  const { dailyPracticeTargetSeconds, vocalRange, mostSungArtist } = profile;
  if (
    dailyPracticeTargetSeconds === undefined &&
    vocalRange === undefined &&
    mostSungArtist === undefined
  ) {
    return null;
  }
  const t = await getTranslations('publicProfile.chips');

  return (
    <ul aria-label={t('label')} className="flex flex-wrap gap-2">
      {dailyPracticeTargetSeconds === undefined ? null : (
        <ProfileChip
          label={t('dailyTarget')}
          value={t('dailyTargetValue', {
            minutes: dailyPracticeTargetSeconds / 60,
          })}
        />
      )}
      {vocalRange === undefined ? null : (
        <ProfileChip
          label={t('vocalRange')}
          value={`${noteName(vocalRange.lowest)} – ${noteName(vocalRange.highest)}`}
          mono
        />
      )}
      {mostSungArtist === undefined ? null : (
        <ProfileChip label={t('mostSungArtist')} value={mostSungArtist.name} />
      )}
    </ul>
  );
}

/**
 * One outlined white pill (the header chips of DESIGN.md "Featured blocks"):
 * the label, then the value. Long values break inside the pill, so a 360px
 * screen wraps them instead of overflowing.
 */
function ProfileChip({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <li className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-full border border-primary-foreground/40 px-3 py-1 text-xs">
      <span className="font-semibold">{label}</span>
      <span
        className={cn(
          'min-w-0 break-words font-semibold',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </span>
    </li>
  );
}
