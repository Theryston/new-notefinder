'use client';

import { MicIcon, MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { type PlaybackSource, stopMic, toggleMic } from '../mic-controller';
import { useMicState } from '../stores/mic-store';

/**
 * The dock's mic toggle (sing mode on and off). The tip and the errors it can
 * raise are shown by {@link DockMicNotice}. Leaving the page releases the mic,
 * even when it is still starting.
 */
export function DockMicButton({ playback }: { playback: PlaybackSource }) {
  const t = useTranslations('practice.mic');
  const status = useMicState((state) => state.status);
  const on = status === 'on';
  const starting = status === 'starting';

  useEffect(() => stopMic, []);

  return (
    <Button
      variant={on ? 'default' : 'secondary'}
      size="icon"
      aria-pressed={on}
      aria-busy={starting}
      aria-label={starting ? t('starting') : on ? t('off') : t('on')}
      disabled={starting}
      onClick={() => void toggleMic(playback)}
    >
      {starting ? (
        <Spinner aria-hidden="true" />
      ) : on ? (
        <MicIcon aria-hidden="true" />
      ) : (
        <MicOffIcon aria-hidden="true" />
      )}
    </Button>
  );
}
