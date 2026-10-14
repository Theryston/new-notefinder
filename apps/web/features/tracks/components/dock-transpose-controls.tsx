'use client';

import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { playbackStore, usePlaybackState } from '../stores/playback-store';
import { saveTrackTranspose } from '../transpose-storage';

/** Always-visible semitone controls; YouTube playback itself stays in its key. */
export function DockTransposeControls({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.practice.dock.transpose');
  const transpose = usePlaybackState((state) => state.transpose);
  const change = (amount: number) => {
    const next = transpose + amount;
    playbackStore.setState({ transpose: next });
    saveTrackTranspose(trackId, next);
    toast(t('videoUnchanged'));
  };

  return (
    <fieldset aria-label={t('label')} className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('down')}
        onClick={() => change(-1)}
      >
        <ChevronDownIcon aria-hidden="true" />
      </Button>
      <span
        aria-live="polite"
        className="min-w-7 text-center font-mono text-xs tabular-nums"
      >
        {transpose > 0 ? `+${transpose}` : transpose}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('up')}
        onClick={() => change(1)}
      >
        <ChevronUpIcon aria-hidden="true" />
      </Button>
    </fieldset>
  );
}
