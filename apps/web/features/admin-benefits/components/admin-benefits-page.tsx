import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminBenefits } from './admin-benefits';

export async function AdminBenefitsPage() {
  const t = await getTranslations('adminBenefits');
  const { adminBenefits, errors } = await getMessages();
  return (
    <div className="flex flex-col gap-3 py-10 md:py-12">
      <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <p className="max-w-prose text-muted-foreground">{t('description')}</p>
      <NextIntlClientProvider messages={{ adminBenefits, errors }}>
        <AdminBenefits />
      </NextIntlClientProvider>
    </div>
  );
}
