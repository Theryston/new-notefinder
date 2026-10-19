'use client';

import type { PracticeAttemptHistoryItem } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { Link } from '@/lib/i18n/navigation';

import { AccuracyChip } from './accuracy-chip';

/** The artist credit as one line, joining each name to its join phrase. */
const creditLine = (
  credit: PracticeAttemptHistoryItem['track']['artistCredit'],
) => credit.map((entry) => `${entry.name}${entry.joinPhrase}`).join('');

/**
 * One practice run: the Track's cover, its title and artist, the setup it was
 * sung with, the time of day (once the viewer's time zone is known, `null`
 * before), and the accuracy chip. A run flagged as bleed-suspected says so.
 */
export function PracticeHistoryRow({
  attempt,
  time,
}: {
  attempt: PracticeAttemptHistoryItem;
  time: string | null;
}) {
  const t = useTranslations('profileHistory');
  const { track } = attempt;
  const setup = [
    t(`difficulty.${attempt.difficulty}`),
    t(`octave.${attempt.octaveMode}`),
    t('speed', { speed: attempt.speed }),
    t('transpose', { semitones: attempt.transposeSemitones }),
  ];
  return (
    <li className="flex items-center gap-3 rounded-2xl p-2">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
        <TrackCoverArt
          coverArtUrl={track.coverUrl}
          placeholderSeed={track.id}
          sizes="56px"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/tracks/${track.id}`}
          className="truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {track.title}
        </Link>
        <p className="truncate text-muted-foreground text-sm">
          {creditLine(track.artistCredit)}
        </p>
        <p className="truncate text-muted-foreground text-xs">
          {setup.join(' · ')}
          {time === null ? '' : ` · ${time}`}
        </p>
        {attempt.bleedSuspected ? (
          <p className="font-semibold text-muted-foreground text-xs">
            {t('suspected')}
          </p>
        ) : null}
      </div>
      <AccuracyChip accuracy={attempt.accuracy} />
    </li>
  );
}
