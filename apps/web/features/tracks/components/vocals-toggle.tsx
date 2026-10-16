'use client';

import { MicVocalIcon, MusicIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { PlaybackController } from '../playback/playback-controller';

export function VocalsToggle({
  controller,
}: {
  controller: PlaybackController | null;
}) {
  const t = useTranslations('tracks.practice.dock');
  const [vocals, setVocals] = useState(false);
  return (
    <Button
      variant={vocals ? 'default' : 'secondary'}
      size="icon"
      className="md:w-auto md:gap-2 md:px-3"
      aria-pressed={vocals}
      aria-label={vocals ? t('vocalsOff') : t('vocalsOn')}
      disabled={!controller}
      onClick={() => {
        controller?.setVocalsOnly(!vocals);
        setVocals(!vocals);
      }}
    >
      {vocals ? (
        <MicVocalIcon aria-hidden="true" />
      ) : (
        <MusicIcon aria-hidden="true" />
      )}
      <span className="hidden md:inline">{t('vocalsOnly')}</span>
    </Button>
  );
}
