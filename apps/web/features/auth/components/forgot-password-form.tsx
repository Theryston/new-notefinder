'use client';

import type { ForgotPasswordBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { useRouter } from '@/lib/i18n/navigation';

import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import { fieldErrorKey } from '../field-error';
import { lazyResolver } from '../lazy-resolver';
import { authHref, redirectToFromSearch } from '../redirect-to';
import { browserStorage, rememberCodeSentAt } from '../resend-cooldown';
import { useLocationSearch } from '../use-location-search';
import { FormAlert } from './form-alert';
import { FormField } from './form-field';
import { StepHeader } from './step-header';
import { SubmitButton } from './submit-button';
import { TextLink } from './text-link';

const forgotPasswordResolver = lazyResolver<ForgotPasswordBody>(() =>
  import('@notefinder/contracts').then((m) => m.forgotPasswordBodySchema),
);

function EmailField({ form }: { form: UseFormReturn<ForgotPasswordBody> }) {
  const t = useTranslations('auth');
  const emailError = form.formState.errors.email;

  return (
    <FormField
      id="email"
      label={t('fields.email.label')}
      error={
        emailError && t(`fields.${fieldErrorKey('email', emailError.type)}`)
      }
    >
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={t('fields.email.placeholder')}
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? 'email-error' : undefined}
        {...form.register('email')}
      />
    </FormField>
  );
}

function RememberedLink({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('auth.forgotPassword.request');

  return (
    <p className="text-center text-muted-foreground text-sm">
      {t.rich('remembered', {
        link: (chunks) => (
          <TextLink href={authHref('/sign-in', redirectTo)}>{chunks}</TextLink>
        ),
      })}
    </p>
  );
}

/**
 * Emails a password reset code, then moves on to the reset step. The API
 * answers the same whether the email has an account or not, so an unknown
 * email follows the same path (no account enumeration).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('authErrors');
  const router = useRouter();
  const redirectTo = redirectToFromSearch(useLocationSearch());
  const [error, setError] = useState<AuthErrorCode | null>(null);
  // No defaultValues, so what was typed before hydration is kept.
  const form = useForm<ForgotPasswordBody>({
    resolver: forgotPasswordResolver,
    mode: 'onTouched',
  });
  // Load validation now, so it is ready (and in order) on the first blur.
  useEffect(() => {
    forgotPasswordResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const result = await authRequest(() =>
      loadAuthClient().then((client) =>
        client.emailOtp.requestPasswordReset({ email }),
      ),
    );
    if (result.error) {
      setError(authErrorCode(result.error));
      return;
    }
    // The resend cooldown on the next step counts from now.
    rememberCodeSentAt(browserStorage(), email, Date.now(), 'forget-password');
    router.push(authHref('/forgot-password/reset', redirectTo, { email }));
  });

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        overline={t('forgotPassword.overline')}
        title={t('forgotPassword.request.title')}
        description={t('forgotPassword.request.description')}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{tErrors(error)}</FormAlert>}
        <EmailField form={form} />
        <SubmitButton
          pending={form.formState.isSubmitting}
          className="mt-1 w-full"
        >
          {t('forgotPassword.request.submit')}
        </SubmitButton>
      </form>
      <RememberedLink redirectTo={redirectTo} />
    </div>
  );
}
