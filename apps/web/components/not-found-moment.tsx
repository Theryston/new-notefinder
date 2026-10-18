import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/routing';

/**
 * The translated "page not found" moment: a centered block with the home
 * (primary) and search (secondary) recovery actions, both in the visitor's
 * locale. The "404" overline sits inside the single `<h1>`, so the accessible
 * name reads "404 Page not found".
 */
export async function NotFoundMoment({ locale }: { locale: Locale }) {
  const t = await getTranslations('notFound');

  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center md:py-24">
      <h1 className="flex max-w-[18ch] flex-col items-center gap-3 font-extrabold text-4xl tracking-tight">
        <span className="font-mono font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          404
        </span>
        {t('title')}
      </h1>
      <p className="max-w-prose text-muted-foreground">{t('description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}`} className={buttonVariants()}>
          {t('homeLabel')}
        </Link>
        <Link
          href={`/${locale}/search`}
          className={buttonVariants({ variant: 'secondary' })}
        >
          {t('searchLabel')}
        </Link>
      </div>
    </section>
  );
}
