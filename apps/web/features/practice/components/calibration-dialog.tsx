'use client';

import { CheckIcon, MicIcon, MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { watchCalibrationReading } from '../calibration-reading';
import { startCalibration } from '../calibration-session';
import { useMicState } from '../stores/mic-store';
import { saveSingingAids, useSingingAids } from '../stores/singing-aids-store';

const BEATS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type CalibrationRunState = {
  countIn: number | null;
  remaining: number | null;
  hits: readonly boolean[];
};

function CalibrationProgress({ run }: { run: CalibrationRunState }) {
  const { countIn, remaining, hits } = run;
  const t = useTranslations('practice.aids');
  if (countIn !== null) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="flex flex-col items-center gap-2 rounded-xl bg-muted/60 py-4"
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-primary font-bold font-mono text-3xl text-primary-foreground tabular-nums">
          {t('count', { count: countIn })}
        </div>
        <span className="text-muted-foreground text-xs">{t('getReady')}</span>
      </div>
    );
  }
  const activeBeat = remaining === null ? -1 : 10 - remaining;
  const count = hits.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
      <div className="grid grid-cols-10 gap-1.5" aria-hidden="true">
        {BEATS.map((beat) => {
          const hit = hits[beat];
          const current = beat === activeBeat;
          const past = activeBeat > beat;
          return (
            <div
              key={beat}
              className={
                hit
                  ? 'flex h-7 items-center justify-center rounded-md bg-success text-background transition-transform duration-150'
                  : current
                    ? 'flex h-7 scale-105 items-center justify-center rounded-md bg-primary font-mono font-semibold text-primary-foreground text-xs transition-transform duration-150'
                    : past
                      ? 'flex h-7 items-center justify-center rounded-md bg-foreground/15 text-muted-foreground text-xs'
                      : 'flex h-7 items-center justify-center rounded-md bg-background/60 font-mono text-muted-foreground text-xs'
              }
            >
              {hit ? <CheckIcon className="size-3.5" /> : beat + 1}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{t('captured', { count })}</span>
        {remaining !== null && (
          <span role="status" className="font-mono tabular-nums">
            {t('remaining', { count: remaining })}
          </span>
        )}
      </div>
    </div>
  );
}

function MicLiveBadge({ micOn }: { micOn: boolean }) {
  const t = useTranslations('practice.aids');
  const [singing, setSinging] = useState(false);

  useEffect(() => {
    if (!micOn) {
      setSinging(false);
      return;
    }
    return watchCalibrationReading(({ midi }) => setSinging(midi !== null));
  }, [micOn]);

  if (!micOn) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 font-medium text-destructive text-xs">
        <MicOffIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{t('micRequired')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 font-medium text-xs">
      <span
        aria-hidden="true"
        className={
          singing
            ? 'size-2.5 scale-125 rounded-full bg-success transition-transform'
            : 'size-2.5 rounded-full bg-muted-foreground/40'
        }
      />
      <MicIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span>{t(singing ? 'micHearing' : 'micListening')}</span>
    </div>
  );
}

function useCalibrationRun(open: boolean, micOn: boolean, pause: () => void) {
  const [countIn, setCountIn] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [hits, setHits] = useState<boolean[]>(() => BEATS.map(() => false));
  const [result, setResult] = useState<'saved' | 'retry' | 'audioError' | null>(
    null,
  );
  const cancel = useRef<() => void>(() => {});
  useEffect(() => {
    if (!open || !micOn) {
      cancel.current();
      setCountIn(null);
      setRemaining(null);
    }
  }, [open, micOn]);
  useEffect(() => () => cancel.current(), []);
  const begin = () => {
    pause();
    setResult(null);
    setHits(BEATS.map(() => false));
    setRemaining(null);
    setCountIn(3);
    cancel.current = startCalibration({
      onCountIn: setCountIn,
      onBeat: setRemaining,
      onCapture: (beat) =>
        setHits((prev) =>
          prev.map((item, idx) => (idx === beat ? true : item)),
        ),
      onDone(value) {
        setCountIn(null);
        setRemaining(null);
        setResult(value === null ? 'retry' : 'saved');
        if (value !== null) saveSingingAids({ offset: value });
      },
      onError() {
        setCountIn(null);
        setRemaining(null);
        setResult('audioError');
      },
    });
  };
  return {
    countIn,
    remaining,
    hits,
    result,
    running: countIn !== null || remaining !== null,
    begin,
  };
}

export function CalibrationDialog({
  open,
  onOpenChange,
  pause,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pause: () => void;
}) {
  const t = useTranslations('practice.aids');
  const offset = useSingingAids((state) => state.offset);
  const micOn = useMicState((state) => state.status === 'on');
  const run = useCalibrationRun(open, micOn, pause);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('calibrate')}</DialogTitle>
          <DialogDescription>{t('instructions')}</DialogDescription>
        </DialogHeader>
        <MicLiveBadge micOn={micOn} />
        <CalibrationProgress run={run} />
        <p className="font-mono text-muted-foreground text-xs tabular-nums">
          {t('offset', { milliseconds: Math.round(offset * 1000) })}
        </p>
        {run.result && (
          <p
            role="status"
            className={
              run.result === 'saved'
                ? 'font-medium text-success text-xs'
                : 'font-medium text-destructive text-xs'
            }
          >
            {t(run.result)}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button disabled={!micOn || run.running} onClick={run.begin}>
            {t('start')}
          </Button>
          <Button
            variant="ghost"
            disabled={run.running}
            onClick={() => saveSingingAids({ offset: 0 })}
          >
            {t('reset')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
