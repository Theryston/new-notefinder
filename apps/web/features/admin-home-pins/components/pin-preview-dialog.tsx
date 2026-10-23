'use client';

import type {
  HomeFeedPage,
  HomePinPreviewRequest,
  Locale,
} from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { HomeFeedRows } from '@/features/home/components/home-feed-rows';
import { isLocale } from '@/lib/i18n/routing';
import { fetchAdminPinPreview } from '../admin-pins-client';

type PinPreviewDialogProps = {
  request: HomePinPreviewRequest;
  open: boolean;
  onClose: () => void;
};

/** Renders the draft feed without the home's pagination or engagement tracker. */
export function PinPreviewDialog({
  request,
  open,
  onClose,
}: PinPreviewDialogProps) {
  const t = useTranslations('adminHomePins.form.previewDialog');
  const [locale, setLocale] = useState<Locale>(request.locale);
  const [audience, setAudience] = useState(request.audience);
  const [feed, setFeed] = useState<HomeFeedPage>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    const previewRequest: HomePinPreviewRequest = {
      pin: request.pin,
      locale,
      audience,
      ...(request.pinId ? { pinId: request.pinId } : {}),
    };
    fetchAdminPinPreview(previewRequest)
      .then((result) => {
        if (active) setFeed(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [audience, locale, open, request]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={t('close')} className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-medium">
            {t('locale')}
            <select
              className="h-10 rounded-xl border bg-background px-3 font-normal"
              value={locale}
              onChange={(event) => {
                if (isLocale(event.currentTarget.value)) {
                  setLocale(event.currentTarget.value);
                }
              }}
            >
              <option value="en">English</option>
              <option value="pt-BR">Português (Brasil)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 font-medium">
            {t('audience')}
            <select
              className="h-10 rounded-xl border bg-background px-3 font-normal"
              value={audience}
              onChange={(event) =>
                setAudience(event.currentTarget.value as typeof audience)
              }
            >
              <option value="visitor">{t('visitor')}</option>
              <option value="signed-in">{t('signedIn')}</option>
            </select>
          </label>
        </div>
        <div aria-live="polite" className="min-h-32 overflow-y-auto">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground">
              <Spinner />
              {t('loading')}
            </div>
          ) : failed ? (
            <p role="alert" className="py-8 text-center text-muted-foreground">
              {t('error')}
            </p>
          ) : !feed || feed.rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <HomeFeedRows rows={feed.rows} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
