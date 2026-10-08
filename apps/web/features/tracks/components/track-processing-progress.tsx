import type {
  TrackProcessing,
  TrackProcessingStep,
} from '@notefinder/contracts';
import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useElapsedSince } from '../hooks/use-step-elapsed';
import {
  displayedPercent,
  type StepState,
  stepStates,
} from '../processing-steps';

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckIcon aria-hidden="true" className="size-3.5" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Spinner aria-hidden="true" className="size-3.5" />
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <XIcon aria-hidden="true" className="size-3.5" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="size-6 shrink-0 rounded-full border border-border"
    />
  );
}

function StepItem({
  step,
  state,
}: {
  step: TrackProcessingStep;
  state: StepState;
}) {
  const t = useTranslations('tracks.processing');
  return (
    <li
      data-state={state}
      className={cn(
        'flex items-center gap-3 text-sm',
        state === 'pending' && 'text-muted-foreground',
        state === 'failed' && 'text-destructive',
        state === 'current' && 'font-semibold',
      )}
    >
      <StepIcon state={state} />
      <span>{t(`steps.${step}`)}</span>
      <span className="sr-only">{t(`steps.state.${state}`)}</span>
    </li>
  );
}

/**
 * What the Processing page shows of a Processing: the progress bar, the step it
 * is on, the list of steps and the outcome once there is one. The bar starts
 * each step at its known percentage and creeps toward the next one while the
 * step runs (see `displayedPercent`); a status change jumps it forward. A
 * failed Processing shows its translated reason; a completed one a placeholder
 * until the timeline exists.
 */
export function TrackProcessingProgress({
  processing,
}: {
  processing: TrackProcessing;
}) {
  const t = useTranslations('tracks.processing');
  const elapsedMs = useElapsedSince(
    `${processing.id}/${processing.status}/${processing.resumeFrom ?? ''}`,
  );
  const percent = displayedPercent(
    processing.status,
    processing.resumeFrom,
    elapsedMs,
  );
  const steps = stepStates(processing.status, processing.resumeFrom);
  const failed = processing.status === 'FAILED';
  const statusLabel =
    processing.status === 'QUEUED' ||
    processing.status === 'COMPLETED' ||
    processing.status === 'FAILED'
      ? t(`status.${processing.status}`)
      : t(`steps.${processing.status}`);

  return (
    <section className="flex flex-col gap-5">
      <div
        role="progressbar"
        aria-label={t('progress.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={t('progress.value', { percent })}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-out',
            failed ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p aria-live="polite" className="font-semibold">
        {statusLabel}
      </p>
      <ol aria-label={t('steps.label')} className="flex flex-col gap-3">
        {steps.map((view) => (
          <StepItem key={view.step} step={view.step} state={view.state} />
        ))}
      </ol>
      <ProcessingOutcome processing={processing} />
    </section>
  );
}

/** The closing line while it runs, or the outcome once it has ended. */
function ProcessingOutcome({ processing }: { processing: TrackProcessing }) {
  const t = useTranslations('tracks.processing');
  if (processing.status === 'COMPLETED') {
    return (
      <div className="flex flex-col gap-1">
        <h2 className="font-bold text-xl tracking-tight">
          {t('completed.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('completed.description')}
        </p>
      </div>
    );
  }
  if (processing.status === 'FAILED') {
    return (
      <div className="flex flex-col gap-1">
        <h2 className="font-bold text-xl tracking-tight">
          {t('failed.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(`failed.reason.${processing.failureCode ?? 'INTERNAL'}`)}
        </p>
      </div>
    );
  }
  return <p className="text-muted-foreground text-sm">{t('closeNote')}</p>;
}
