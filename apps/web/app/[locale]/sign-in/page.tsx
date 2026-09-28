import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signIn');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/sign-in'),
  };
}

export default function SignInPage() {
  return (
    <AuthShell step="signIn">
      <SignInForm />
    </AuthShell>
  );
}
