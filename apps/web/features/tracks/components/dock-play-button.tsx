'use client';

import { PauseIcon, PlayIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import type { PlaybackController } from '../playback/playback-controller';
import { usePlaybackState } from '../stores/playback-store';

/**
 * Play and pause. It shows a loading state, and does nothing, until the
 * player reports it is ready, so a press is never lost.
 */
export function DockPlayButton({
  controller,
}: {
  controller: PlaybackController | null;
}) {
  const t = useTranslations('tracks.practice.dock');
  const status = usePlaybackState((state) => state.status);
  const failed = status === 'error';
  const loading = !failed && (controller === null || status === 'loading');
  const playing = status === 'playing';

  return (
    <Button
      size="icon-lg"
      aria-label={loading ? t('loading') : playing ? t('pause') : t('play')}
      aria-busy={loading}
      disabled={loading || failed}
      onClick={() => controller?.toggle()}
      className="shrink-0"
    >
      {loading ? (
        <Spinner aria-hidden="true" />
      ) : playing ? (
        <PauseIcon aria-hidden="true" className="fill-current" />
      ) : (
        <PlayIcon aria-hidden="true" className="fill-current" />
      )}
    </Button>
  );
}
