'use client';

import type { TrackDetail } from '@notefinder/contracts';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { creditText } from '@/lib/track-credit';
import { formatClock } from '../playback/clock-message';
import {
  SHARE_NETWORKS,
  type ShareMessage,
  shareHref,
  shareLink,
} from '../share-link';
import { playbackStore } from '../stores/playback-store';

/** The page the visitor is on; `shareLink` drops its query string. */
const currentPageUrl = () => window.location.href;

/** The link as selectable text, with a button that copies it. */
function CopyLink({ link }: { link: string }) {
  const t = useTranslations('tracks.practice.share');
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // No clipboard permission or API: leave the link selected for Ctrl+C.
      linkRef.current?.select();
      toast.error(t('copyFailed'));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={linkRef}
        readOnly
        value={link}
        aria-label={t('link')}
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-full border border-input bg-muted px-4 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="button" onClick={() => void copy()}>
        {copied ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}

function NetworkShortcuts({ message }: { message: ShareMessage }) {
  const t = useTranslations('tracks.practice.share');

  return (
    <ul aria-label={t('networks')} className="flex flex-wrap gap-2">
      {SHARE_NETWORKS.map((network) => (
        <li key={network}>
          <a
            href={shareHref(network, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            {t(`network.${network}`)}
          </a>
        </li>
      ))}
    </ul>
  );
}

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { title: header.title })}
          </DialogDescription>
        </DialogHeader>
        <CopyLink link={link} />
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
        <NetworkShortcuts message={message} />
      </DialogContent>
    </Dialog>
  );
}
