'use client';

import { HeadphonesIcon, MicIcon, MicOffIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { takeHeadphonesTip } from '../headphones-tip';
import { type PlaybackSource, stopMic, toggleMic } from '../mic-controller';
import { useMicState } from '../stores/mic-store';

/** Says why the mic is not on, or the one-time headphones tip. */
function MicNotice({
  kind,
  onDismiss,
}: {
  kind: 'headphones' | 'denied' | 'unavailable';
  onDismiss: () => void;
}) {
  const t = useTranslations('tracks.practice.mic');
  const message = kind === 'headphones' ? t('headphonesTip') : t(kind);

  return (
    <div
      role={kind === 'headphones' ? 'status' : 'alert'}
      className="glass absolute inset-x-0 bottom-full mb-2 flex items-start gap-2 rounded-2xl p-3 text-sm"
    >
      {kind === 'headphones' ? (
        <HeadphonesIcon aria-hidden="true" className="mt-0.5 shrink-0" />
      ) : (
        <MicOffIcon aria-hidden="true" className="mt-0.5 shrink-0" />
      )}
      <p className="flex-1">{message}</p>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t('dismiss')}
        onClick={onDismiss}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * The dock's mic toggle (sing mode on and off). The first time it turns on it
 * shows a tip to wear headphones; a refused or missing mic shows how to fix
 * it. The notice sits above the dock, which is the positioned ancestor.
 */
export function DockMicButton({ playback }: { playback: PlaybackSource }) {
  const t = useTranslations('tracks.practice.mic');
  const status = useMicState((state) => state.status);
  const problem = useMicState((state) => state.problem);
  const [tip, setTip] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const on = status === 'on';
  const starting = status === 'starting';

  // Leaving the page releases the mic: the browser's recording light goes off.
  useEffect(() => stopMic, []);
  useEffect(() => {
    if (on && takeHeadphonesTip()) setTip(true);
    if (!on) setTip(false);
  }, [on]);

  const wanted = problem ?? (tip ? 'headphones' : null);
  const kind = wanted !== null && dismissed !== wanted ? wanted : null;

  return (
    <>
      {kind !== null ? (
        <MicNotice
          kind={kind}
          onDismiss={() => {
            setDismissed(kind);
            setTip(false);
          }}
        />
      ) : null}
      <Button
        variant={on ? 'default' : 'ghost'}
        size="icon"
        aria-pressed={on}
        aria-busy={starting}
        aria-label={starting ? t('starting') : on ? t('off') : t('on')}
        disabled={starting}
        onClick={() => {
          setDismissed(null);
          void toggleMic(playback);
        }}
      >
        {starting ? (
          <Spinner aria-hidden="true" />
        ) : on ? (
          <MicIcon aria-hidden="true" />
        ) : (
          <MicOffIcon aria-hidden="true" />
        )}
      </Button>
    </>
  );
}
