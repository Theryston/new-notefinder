'use client';

import type { TrackNote } from '@notefinder/contracts';
import { MaximizeIcon, SkipForwardIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

import { nextNotesTarget } from '../listening/listening-math';
import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore } from '../stores/playback-store';

export function ListeningActions({
  notes,
  controller,
  container,
}: {
  notes: readonly TrackNote[];
  controller: PlaybackController | null;
  container: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('tracks.practice.listening');
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => {
      if (next.current)
        next.current.hidden =
          nextNotesTarget(notes, playbackStore.getState().time) === null;
    };
    update();
    return playbackStore.subscribe(update);
  }, [notes]);
  return (
    <div className="practice-listening-actions flex items-center justify-end gap-2">
      <Button
        ref={next}
        hidden={!notes.length}
        variant="secondary"
        disabled={!controller}
        onClick={() => {
          const target = nextNotesTarget(notes, playbackStore.getState().time);
          if (target !== null) controller?.seek(target);
        }}
      >
        <SkipForwardIcon aria-hidden="true" />
        {t('nextNotes')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('fullscreen')}
        onClick={() => {
          const action = document.fullscreenElement
            ? document.exitFullscreen()
            : container.current?.requestFullscreen?.();
          void action?.catch(() => undefined);
        }}
      >
        <MaximizeIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
