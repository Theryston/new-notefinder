'use client';

import { useTranslations } from 'next-intl';

import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';

import { loopRange } from '../listening/listening-math';
import { useLoop } from '../listening/loop-store';
import { playbackStore, usePlaybackState } from '../stores/playback-store';

export function LoopSetting() {
  const t = useTranslations('tracks.practice.listening');
  const range = useLoop((state) => state.range);
  const duration = usePlaybackState((state) => state.duration);
  return (
    <DropdownMenuCheckboxItem
      closeOnClick
      checked={range !== null}
      disabled={duration <= 0}
      onCheckedChange={(enabled) => {
        const { time, duration: total } = playbackStore.getState();
        useLoop.setState({
          range: enabled ? loopRange(time, time + 10, total) : null,
        });
      }}
    >
      {t('loop')}
    </DropdownMenuCheckboxItem>
  );
}
