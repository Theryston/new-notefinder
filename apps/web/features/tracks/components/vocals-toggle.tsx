'use client';

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
      variant="ghost"
      aria-pressed={vocals}
      disabled={!controller}
      onClick={() => {
        controller?.setVocalsOnly(!vocals);
        setVocals(!vocals);
      }}
    >
      {t('vocalsOnly')}
    </Button>
  );
}
