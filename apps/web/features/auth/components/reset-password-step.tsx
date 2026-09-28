'use client';

import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import { authHref, safeRedirectPath } from '../redirect-to';
import { ResetPasswordForm } from './reset-password-form';
import { StepHeader } from './step-header';

/** Without an email there's no code to check: ask for one first. */
function MissingEmail({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('auth.forgotPassword');

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        overline={t('overline')}
        title={t('reset.missing.title')}
        description={t('reset.missing.description')}
      />
      <Link
        href={authHref('/forgot-password', redirectTo)}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t('reset.missing.cta')}
      </Link>
    </div>
  );
}

/** Reads `email` and `redirectTo` from the URL (render inside Suspense). */
export function ResetPasswordStep() {
  const [email] = useQueryState('email');
  const [redirectParam] = useQueryState('redirectTo');
  const redirectTo = safeRedirectPath(redirectParam);

  if (!email) return <MissingEmail redirectTo={redirectTo} />;
  // Keyed so a different email starts with a fresh form and cooldown.
  return (
    <ResetPasswordForm key={email} email={email} redirectTo={redirectTo} />
  );
}
