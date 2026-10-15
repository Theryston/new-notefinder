'use client';

import type { TrackNote } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import type { PlaybackSource } from '../mic-controller';
import { detectedName, targetNameAt } from '../readout';
import { voiceTrail } from '../voice-trail';

/**
 * The note to sing and the note being sung, as text, so the feedback never
 * relies on the voice line's color or position alone. Both update straight in
 * the DOM from the playback and voice subscriptions: this is not re-rendered
 * per frame.
 */
export function SingReadout({
  notes,
  playback,
}: {
  notes: readonly TrackNote[];
  playback: PlaybackSource;
}) {
  const t = useTranslations('practice.sing');
  const none = t('none');
  const target = useRef<HTMLSpanElement>(null);
  const detected = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      const targetText = targetNameAt(notes, playback.getState().time) ?? none;
      const detectedText = detectedName(voiceTrail.latest()) ?? none;
      if (target.current && target.current.textContent !== targetText) {
        target.current.textContent = targetText;
      }
      if (detected.current && detected.current.textContent !== detectedText) {
        detected.current.textContent = detectedText;
      }
    };
    update();
    const stopPlayback = playback.subscribe(update);
    const stopVoice = voiceTrail.subscribe(update);
    return () => {
      stopPlayback();
      stopVoice();
    };
  }, [notes, playback, none]);

  return (
    <div className="flex items-center gap-4 font-mono text-sm tabular-nums">
      <span className="flex items-baseline gap-2">
        <span className="font-sans text-muted-foreground">{t('target')}</span>
        <span
          ref={target}
          data-testid="target-note"
          className="font-semibold text-primary"
        >
          {none}
        </span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-sans text-muted-foreground">{t('you')}</span>
        <span
          ref={detected}
          data-testid="detected-note"
          className="font-semibold"
        >
          {none}
        </span>
      </span>
    </div>
  );
}
