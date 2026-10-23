'use client';

import type { HomePinPreviewRequest, Locale } from '@notefinder/contracts';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

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
import enMessages from '@/messages/en.json';
import ptBrMessages from '@/messages/pt-BR.json';
import { useAdminPinPreview } from '../hooks/use-admin-pin-preview';

const homePreviewMessages = {
  en: { home: enMessages.home, tracks: enMessages.tracks },
  'pt-BR': { home: ptBrMessages.home, tracks: ptBrMessages.tracks },
};

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
  const previewRequest = useMemo<HomePinPreviewRequest>(
    () => ({
      pin: request.pin,
      locale,
      audience,
      ...(request.pinId ? { pinId: request.pinId } : {}),
    }),
    [audience, locale, request],
  );
  const {
    data: feed,
    isError,
    isPending,
  } = useAdminPinPreview(previewRequest, open);

  useEffect(() => {
    setLocale(request.locale);
    setAudience(request.audience);
  }, [request.audience, request.locale]);

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
              <option value="en">{t('localeOptions.en')}</option>
              <option value="pt-BR">{t('localeOptions.ptBR')}</option>
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
          {isPending ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground">
              <Spinner />
              {t('loading')}
            </div>
          ) : isError ? (
            <p role="alert" className="py-8 text-center text-muted-foreground">
              {t('error')}
            </p>
          ) : !feed || feed.rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <NextIntlClientProvider
              locale={locale}
              messages={homePreviewMessages[locale]}
            >
              <HomeFeedRows rows={feed.rows} />
            </NextIntlClientProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
