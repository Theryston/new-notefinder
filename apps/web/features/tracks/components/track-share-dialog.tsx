'use client';

import type { TrackDetail } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { ShareDialog } from '@/components/share/share-dialog';

import { formatClock } from '../playback/clock-message';
import { shareLink } from '../share-link';
import { playbackStore } from '../stores/playback-store';
import { creditText } from '../track-credit';

/** The page the visitor is on; `shareLink` drops its query string. */
const currentPageUrl = () => window.location.href;

/**
 * The share dialog: the link with a copy button, an "Include current moment"
 * box (on by default, adding `?time=`) and shortcuts to the networks. The
 * moment is read when the dialog opens; the link is also shown as text, which
 * stays selectable where copying or a custom scheme does not work.
 */
export function TrackShareDialog({
  header,
  open,
  onOpenChange,
}: {
  header: TrackDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('tracks.practice.share');
  const clock = useTranslations('tracks.practice');
  const checkboxId = useId();
  const [moment] = useState(() => playbackStore.getState().time);
  const [includeMoment, setIncludeMoment] = useState(true);
  const [pageUrl] = useState(currentPageUrl);
  const link = shareLink(pageUrl, includeMoment ? moment : null);
  const artists = creditText(header.artistCredit);
  const message = {
    url: link,
    text:
      artists === ''
        ? t('textNoArtists', { title: header.title })
        : t('text', { title: header.title, artists }),
    subject: t('subject', { title: header.title }),
  };

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description', { title: header.title })}
      closeLabel={t('close')}
      link={link}
      linkLabels={{
        link: t('link'),
        copy: t('copy'),
        copied: t('copied'),
        copyFailed: t('copyFailed'),
      }}
      message={message}
      networksLabel={t('networks')}
      networkName={(network) => t(`network.${network}`)}
    >
      <label
        htmlFor={checkboxId}
        className="flex min-h-10 cursor-pointer items-center gap-3 font-medium text-sm"
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={includeMoment}
          onChange={(event) => setIncludeMoment(event.target.checked)}
          className="size-4 accent-primary"
        />
        {t('includeMoment', {
          time: formatClock(moment, (key, values) => clock(key, values)),
        })}
      </label>
    </ShareDialog>
  );
}
