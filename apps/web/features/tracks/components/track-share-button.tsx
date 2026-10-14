'use client';

import type { TrackDetail } from '@notefinder/contracts';
import { Share2Icon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

// Loaded on the first click, on the client only: Base UI's dialog stays out
// of the page's first-load JS, and nothing of it is needed until then.
const TrackShareDialog = dynamic(
  () =>
    import('./track-share-dialog').then((module) => module.TrackShareDialog),
  { ssr: false },
);

/** The title row's share button; it opens the share dialog. */
export function TrackShareButton({ header }: { header: TrackDetail }) {
  const t = useTranslations('tracks.practice.share');
  const [opened, setOpened] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t('open')}
        title={t('open')}
        aria-haspopup="dialog"
        className="shrink-0"
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
      >
        <Share2Icon aria-hidden="true" />
      </Button>
      {opened ? (
        <TrackShareDialog header={header} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
