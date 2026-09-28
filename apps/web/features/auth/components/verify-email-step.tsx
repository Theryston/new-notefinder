'use client';

import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import { authHref, safeRedirectPath } from '../redirect-to';
import { StepHeader } from './step-header';
import { VerifyEmailForm } from './verify-email-form';

/** Legacy `/verify-email` links carry no email: point them to sign-up. */
function MissingEmail({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('auth.verifyEmail.missing');

  return (
    <div className="flex flex-col gap-8">
      <StepHeader step={2} title={t('title')} description={t('description')} />
      <Link
        href={authHref('/sign-up', redirectTo)}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t('cta')}
      </Link>
    </div>
  );
}

/** Reads `email` and `redirectTo` from the URL (render inside Suspense). */
export function VerifyEmailStep() {
  const [email] = useQueryState('email');
  const [redirectParam] = useQueryState('redirectTo');
  const redirectTo = safeRedirectPath(redirectParam);

  if (!email) return <MissingEmail redirectTo={redirectTo} />;
  // Keyed so a different email starts with a fresh form and cooldown.
  return <VerifyEmailForm key={email} email={email} redirectTo={redirectTo} />;
}
