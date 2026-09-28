'use client';

import type { ResetPasswordBody } from '@notefinder/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';

import { useRouter } from '@/lib/i18n/navigation';

import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import { isCodeError } from '../code-error';
import { lazyResolver } from '../lazy-resolver';
import { authKeys } from '../query-keys';
import { authHref } from '../redirect-to';
import { CodeInput, isCompleteCode } from './code-input';
import { NewPasswordField } from './credential-fields';
import { FormAlert } from './form-alert';
import { ResendCodeButton } from './resend-code-button';
import { StepHeader } from './step-header';
import { SubmitButton } from './submit-button';
import { TextLink } from './text-link';

const resetPasswordResolver = lazyResolver<ResetPasswordBody>(() =>
  import('@notefinder/contracts').then((m) => m.resetPasswordBodySchema),
);

type Notice = { tone: 'error'; code: AuthErrorCode } | { tone: 'success' };

function ResetPasswordHeader({ email }: { email: string }) {
  const t = useTranslations('auth.forgotPassword');

  return (
    <StepHeader
      overline={t('overline')}
      title={t('reset.title')}
      description={t.rich('reset.description', {
        email: () => (
          <strong className="wrap-break-word font-semibold text-foreground">
            {email}
          </strong>
        ),
      })}
    />
  );
}

function ResetPasswordFooter({
  email,
  redirectTo,
  onNotice,
}: {
  email: string;
  redirectTo: string;
  onNotice: (notice: Notice) => void;
}) {
  const t = useTranslations('auth.forgotPassword.reset');

  return (
    <div className="-mt-4 flex flex-wrap items-center justify-between gap-2">
      <ResendCodeButton
        email={email}
        purpose="forget-password"
        onSent={() => onNotice({ tone: 'success' })}
        onError={(code) => onNotice({ tone: 'error', code })}
      />
      <p className="px-4 text-muted-foreground text-sm">
        {t.rich('wrongEmail', {
          link: (chunks) => (
            <TextLink href={authHref('/forgot-password', redirectTo)}>
              {chunks}
            </TextLink>
          ),
        })}
      </p>
    </div>
  );
}

/** The error or confirmation shown on top of the form. */
function ResetPasswordNotice({
  notice,
  invalidEmail,
}: {
  notice: Notice | null;
  invalidEmail: boolean;
}) {
  const t = useTranslations('auth.forgotPassword.reset');
  const tErrors = useTranslations('authErrors');

  // The email comes from the URL, with no field to show its error next to.
  if (invalidEmail) return <FormAlert>{tErrors('INVALID_EMAIL')}</FormAlert>;
  if (!notice) return null;
  return (
    <FormAlert tone={notice.tone}>
      {notice.tone === 'error' ? tErrors(notice.code) : t('resent')}
    </FormAlert>
  );
}

/** The emailed code, then the new password once it is complete. */
function ResetPasswordFields({
  form,
  notice,
}: {
  form: UseFormReturn<ResetPasswordBody>;
  notice: Notice | null;
}) {
  const t = useTranslations('auth.forgotPassword.reset');

  return (
    <>
      <Controller
        control={form.control}
        name="otp"
        render={({ field }) => (
          <CodeInput
            field={field}
            label={t('codeLabel')}
            invalid={notice?.tone === 'error' && isCodeError(notice.code)}
            onComplete={() => form.setFocus('password')}
          />
        )}
      />
      <NewPasswordField
        registration={form.register('password')}
        errorType={form.formState.errors.password?.type}
        password={form.watch('password')}
        label={t('passwordLabel')}
      />
    </>
  );
}

/**
 * The emailed code and the new password. On success every session is
 * revoked (the API does it), so the user signs in again with the new one.
 */
export function ResetPasswordForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const t = useTranslations('auth.forgotPassword.reset');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const form = useForm<ResetPasswordBody>({
    resolver: resetPasswordResolver,
    mode: 'onTouched',
    defaultValues: { email, otp: '', password: '' },
  });
  // Load validation now, so it is ready (and in order) on the first blur.
  useEffect(() => {
    resetPasswordResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    const { error } = await authRequest(() =>
      loadAuthClient().then((client) => client.emailOtp.resetPassword(values)),
    );
    if (error) {
      const code = authErrorCode(error);
      setNotice({ tone: 'error', code });
      if (isCodeError(code)) {
        form.setValue('otp', '');
        form.setFocus('otp');
      }
      return;
    }
    // The reset signed this browser out too, if it was signed in.
    await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    router.push(authHref('/sign-in', redirectTo, { reset: '1' }));
  });

  return (
    <div className="flex flex-col gap-8">
      <ResetPasswordHeader email={email} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <ResetPasswordNotice
          notice={notice}
          invalidEmail={Boolean(form.formState.errors.email)}
        />
        <ResetPasswordFields form={form} notice={notice} />
        <SubmitButton
          pending={form.formState.isSubmitting}
          disabled={!isCompleteCode(form.watch('otp'))}
          className="mt-1 w-full"
        >
          {t('submit')}
        </SubmitButton>
      </form>
      <ResetPasswordFooter
        email={email}
        redirectTo={redirectTo}
        onNotice={setNotice}
      />
    </div>
  );
}
