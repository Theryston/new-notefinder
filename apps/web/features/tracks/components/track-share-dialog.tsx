'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Share2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { playbackStore } from '../stores/playback-store';

const NETWORKS = ['whatsapp', 'telegram', 'x', 'facebook', 'email'] as const;

function shareUrl(includeMoment: boolean): string {
  const url = new URL(window.location.href);
  if (includeMoment) {
    url.searchParams.set(
      'time',
      String(Math.floor(playbackStore.getState().time)),
    );
  } else {
    url.searchParams.delete('time');
  }
  return url.toString();
}

function networkUrl(
  network: (typeof NETWORKS)[number],
  url: string,
  message: string,
): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);
  switch (network) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
    case 'x':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedMessage}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'email':
      return `mailto:?subject=${encodedMessage}&body=${encodeURIComponent(`${message} ${url}`)}`;
  }
}

/** A copyable Track URL with optional playback position and share shortcuts. */
export function TrackShareDialog({
  trackId,
  title,
}: {
  trackId: string;
  title: string;
}) {
  const t = useTranslations('tracks.practice.share');
  const [open, setOpen] = useState(false);
  const [includeMoment, setIncludeMoment] = useState(true);
  const [copied, setCopied] = useState(false);
  const url = open ? shareUrl(includeMoment) : '';
  const message = t('message', { title });

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={t('action')}
          />
        }
      >
        <Share2Icon aria-hidden="true" />
        {t('action')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup className="w-full max-w-lg rounded-2xl bg-popover p-6 text-popover-foreground shadow-xl outline-none">
            <Dialog.Title className="font-heading font-semibold text-lg">
              {t('title')}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-muted-foreground text-sm">
              {t('description')}
            </Dialog.Description>
            <div className="mt-5 flex gap-2">
              <label className="sr-only" htmlFor={`share-link-${trackId}`}>
                {t('linkLabel')}
              </label>
              <input
                id={`share-link-${trackId}`}
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-full border border-input bg-muted px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="button" size="sm" onClick={copyLink}>
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
            <label className="mt-4 flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={includeMoment}
                onChange={(event) => {
                  setIncludeMoment(event.currentTarget.checked);
                  setCopied(false);
                }}
                className="size-4 accent-primary"
              />
              {t('includeMoment')}
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NETWORKS.map((network) => (
                <a
                  key={network}
                  href={networkUrl(network, url, message)}
                  target={network === 'email' ? undefined : '_blank'}
                  rel={network === 'email' ? undefined : 'noreferrer'}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-secondary px-4 font-semibold text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t(`networks.${network}`)}
                </a>
              ))}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
