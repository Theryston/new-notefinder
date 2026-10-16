'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId } from 'react';

import { Switch } from '@/components/ui/switch';

import {
  autoGuideMelody,
  saveSingingAids,
  useSingingAids,
} from '../stores/singing-aids-store';

/**
 * The guide-melody switch living in the transpose popover, with its auto
 * behavior: away from the original key the video keeps its pitch, so the
 * guide plays the transposed notes; back on zero it goes quiet. The effect
 * also re-runs on the guide itself, so late-loaded preferences converge.
 * Picking the switch by hand marks it manual, which the auto behavior never
 * overrides, on or off.
 */
export function GuideMelodyControl({
  semitones,
  directAudio,
}: {
  semitones: number;
  directAudio: boolean;
}) {
  const t = useTranslations('practice.aids');
  const guide = useSingingAids((state) => state.guideMelody);
  const switchId = useId();

  useEffect(() => {
    if (directAudio) return;
    // Read so late-loaded preferences re-run the auto behavior below.
    if (guide === (semitones !== 0)) return;
    autoGuideMelody(semitones !== 0);
  }, [semitones, directAudio, guide]);

  return (
    <label
      htmlFor={switchId}
      className="flex min-h-10 cursor-pointer items-center gap-3 font-medium text-sm"
    >
      <Switch
        id={switchId}
        checked={guide}
        onCheckedChange={(value) =>
          saveSingingAids({ guideMelody: value, guideMelodyManual: true })
        }
      />
      {t('guideMelody')}
    </label>
  );
}
