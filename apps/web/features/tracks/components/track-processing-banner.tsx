import type { TrackHeader, TrackProcessing } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import {
  entityBannerRowClass,
  entityBannerSurfaceClass,
  entityInfoClass,
} from '@/components/entity-header';

import { stepPosition } from '../processing-steps';
import { creditText } from '../track-credit';
import { TrackProcessingRing } from './track-processing-ring';
import { TrackProcessingSteps } from './track-processing-steps';

/**
 * A step down from the artist and album display titles: the ring and the
 * step pills share the block, so the title gives them room.
 */
const TITLE_CLASS =
  'min-w-0 break-words font-extrabold text-4xl leading-none tracking-tighter md:text-5xl';

/**
 * The line above the title: the step it is on (or stopped at) out of all of
 * them, else "queued" or "failed" when there is no step to name.
 */
function StageLine({ processing }: { processing: TrackProcessing }) {
  const t = useTranslations('tracks.processing');
  const position = stepPosition(processing.status, processing.resumeFrom);
  const failed = processing.status === 'FAILED';
  let text: string;
  if (position === null) {
    text = failed ? t('status.FAILED') : t('status.QUEUED');
  } else {
    const values = { current: position.number, total: position.total };
    text = failed ? t('stage.stopped', values) : t('stage.running', values);
  }
  return (
    <p
      aria-live="polite"
      className="font-bold text-sm uppercase tracking-wider"
    >
      {text}
    </p>
  );
}

/**
 * The Processing page's featured block: the stage, the title, the artist
 * credit and the steps as pills on the left; the cover inside the progress
 * ring on the right. Without a Processing it is the title and the cover only.
 */
export function TrackProcessingBanner({
  track,
  processing,
  percent,
}: {
  track: TrackHeader;
  processing: TrackProcessing | null;
  percent: number | null;
}) {
  return (
    <section aria-labelledby="track-title" className={entityBannerSurfaceClass}>
      <div className={entityBannerRowClass}>
        <TrackProcessingRing track={track} percent={percent} />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
          {processing === null ? null : <StageLine processing={processing} />}
          <h1 id="track-title" className={TITLE_CLASS}>
            {track.title}
          </h1>
          {track.artistCredit.length > 0 ? (
            <p className={entityInfoClass}>{creditText(track.artistCredit)}</p>
          ) : null}
          {processing === null ? null : (
            <div className="pt-2">
              <TrackProcessingSteps processing={processing} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
