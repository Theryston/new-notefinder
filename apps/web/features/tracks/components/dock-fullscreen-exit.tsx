'use client';

import { MinimizeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export function DockFullscreenExit() {
  const t = useTranslations('tracks.practice.listening');
  return (
    <Button
      className="dock-fullscreen-exit hidden"
      variant="ghost"
      size="icon"
      aria-label={t('fullscreen')}
      onClick={() => {
        void document.exitFullscreen().catch(() => undefined);
      }}
    >
      <MinimizeIcon aria-hidden="true" />
    </Button>
  );
}
