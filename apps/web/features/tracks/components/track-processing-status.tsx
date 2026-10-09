import type { TrackProcessing } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { remainingMinutes } from '../processing-steps';
import { isRetryOffered } from '../retry-offer';
import { TrackRetry } from './track-retry';

const TITLE_CLASS = 'font-bold text-2xl tracking-tight';
const TEXT_CLASS = 'max-w-prose text-muted-foreground text-sm';

function CloseNote() {
  const t = useTranslations('tracks.processing');
  return <p className={TEXT_CLASS}>{t('closeNote')}</p>;
}

/** Why the Processing failed and, when a retry can fix it, "Try again". */
function FailedStatus({
  trackId,
  processing,
}: {
  trackId: string;
  processing: TrackProcessing;
}) {
  const t = useTranslations('tracks.processing');
  return (
    <>
      <h2 className={TITLE_CLASS}>{t('failed.title')}</h2>
      <p className={TEXT_CLASS}>
        {t(`failed.reason.${processing.failureCode ?? 'INTERNAL'}`)}
      </p>
      {isRetryOffered(processing) ? (
        <div className="pt-2">
          <TrackRetry trackId={trackId} />
        </div>
      ) : null}
    </>
  );
}

/**
 * What happens now, under the banner: the running step with what it does and
 * about how long is left, the wait while queued, or the failure. A completed
 * Processing never gets here (the page shows only a line then).
 */
export function TrackProcessingStatus({
  trackId,
  processing,
  elapsedMs,
}: {
  trackId: string;
  processing: TrackProcessing;
  elapsedMs: number;
}) {
  const t = useTranslations('tracks.processing');
  const { status } = processing;
  if (status === 'COMPLETED') return null;

  let body: ReactNode;
  if (status === 'FAILED') {
    body = <FailedStatus trackId={trackId} processing={processing} />;
  } else if (status === 'QUEUED') {
    body = (
      <>
        <h2 className={TITLE_CLASS}>{t('queued.title')}</h2>
        <CloseNote />
      </>
    );
  } else {
    body = (
      <>
        <h2 className={TITLE_CLASS}>{t(`steps.${status}`)}</h2>
        <p className={TEXT_CLASS}>{t(`steps.description.${status}`)}</p>
        <p className="font-medium text-sm tabular-nums">
          {t('remaining', {
            minutes: remainingMinutes(status, elapsedMs) ?? 0,
          })}
        </p>
        <CloseNote />
      </>
    );
  }
  return <section className="flex flex-col gap-2">{body}</section>;
}
