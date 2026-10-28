import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminPlans } from './admin-plans';

export async function AdminPlansPage() {
  const t = await getTranslations('adminPlans');
  const { adminPlans, errors } = await getMessages();
  return (
    <section className="py-10 md:py-12">
      <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">{t('intro')}</p>
      <NextIntlClientProvider messages={{ adminPlans, errors }}>
        <AdminPlans />
      </NextIntlClientProvider>
    </section>
  );
}
