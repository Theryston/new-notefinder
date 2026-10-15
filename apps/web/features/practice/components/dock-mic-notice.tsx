'use client';

import { HeadphonesIcon, MicOffIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { dismissMicNotice } from '../mic-controller';
import { useMicState } from '../stores/mic-store';

/**
 * The one-time headphones tip, or why the mic did not start. It is a row of
 * the dock itself (the dock's grid places it under the controls), so the dock
 * grows by its height and the page's bottom padding, which follows the dock,
 * keeps it clear of the timeline.
 */
export function DockMicNotice() {
  const t = useTranslations('practice.mic');
  const notice = useMicState((state) => state.notice);
  if (notice === null) return null;

  return (
    <div
      role={notice === 'headphones' ? 'status' : 'alert'}
      data-testid="mic-notice"
      className="col-span-full flex items-center gap-2 rounded-xl bg-muted p-2 pl-3 text-sm"
    >
      {notice === 'headphones' ? (
        <HeadphonesIcon aria-hidden="true" className="shrink-0" />
      ) : (
        <MicOffIcon aria-hidden="true" className="shrink-0" />
      )}
      <p className="min-w-0 flex-1">
        {notice === 'headphones' ? t('headphonesTip') : t(notice)}
      </p>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('dismiss')}
        onClick={dismissMicNotice}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
