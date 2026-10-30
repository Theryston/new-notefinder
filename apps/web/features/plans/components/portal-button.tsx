'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function PortalButton({ recovery = false }: { recovery?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('billing.subscription');
  const portal = useMutation({
    mutationFn: async () => {
      const [{ browserApi }, { portalSessionSchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@vozzify/contracts'),
      ]);
      return browserApi('/me/subscription/portal', {
        schema: portalSessionSchema,
        method: 'POST',
        body: { locale },
      });
    },
    onSuccess: ({ url }) => window.location.assign(url),
  });
  return (
    <div className="relative w-full space-y-2">
      <Button
        className="w-full"
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        {t(recovery ? 'updatePayment' : 'manage')}
        <ArrowRightIcon aria-hidden />
      </Button>
      {portal.isError ? <p role="alert">{t('manageError')}</p> : null}
    </div>
  );
}
