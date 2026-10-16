'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { Switch } from '@/components/ui/switch';

import { saveSingingAids, useSingingAids } from '../stores/singing-aids-store';

/**
 * The guide-melody switch living in the transpose popover, with its auto
 * behavior is managed by the always-mounted transpose popover owner, so it
 * continues to follow a key change while this content is closed. Picking the
 * switch by hand marks it manual, which the auto behavior never overrides.
 */
export function GuideMelodyControl() {
  const t = useTranslations('practice.aids');
  const guide = useSingingAids((state) => state.guideMelody);
  const switchId = useId();

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
