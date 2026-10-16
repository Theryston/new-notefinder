'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { startCalibration } from '../calibration-session';
import { useMicState } from '../stores/mic-store';
import { saveSingingAids, useSingingAids } from '../stores/singing-aids-store';

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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<'saved' | 'retry' | 'audioError' | null>(
    null,
  );
  const cancel = useRef<() => void>(() => {});
  useEffect(() => {
    if (!open || !micOn) {
      cancel.current();
      setRemaining(null);
    }
  }, [open, micOn]);
  useEffect(() => () => cancel.current(), []);
  const begin = () => {
    pause();
    setResult(null);
    setRemaining(10);
    cancel.current = startCalibration({
      onBeat: setRemaining,
      onDone(value) {
        setRemaining(null);
        setResult(value === null ? 'retry' : 'saved');
        if (value !== null) saveSingingAids({ offset: value });
      },
      onError() {
        setRemaining(null);
        setResult('audioError');
      },
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        <DialogTitle>{t('calibrate')}</DialogTitle>
        <DialogDescription>{t('instructions')}</DialogDescription>
        <p>{t('offset', { milliseconds: Math.round(offset * 1000) })}</p>
        {!micOn && <p>{t('micRequired')}</p>}
        {remaining !== null && (
          <p role="status">{t('remaining', { count: remaining })}</p>
        )}
        {result && <p role="status">{t(result)}</p>}
        <Button disabled={!micOn || remaining !== null} onClick={begin}>
          {t('start')}
        </Button>
        <Button
          variant="ghost"
          disabled={remaining !== null}
          onClick={() => saveSingingAids({ offset: 0 })}
        >
          {t('reset')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
