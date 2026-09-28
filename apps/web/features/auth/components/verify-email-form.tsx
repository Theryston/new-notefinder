'use client';

import type { VerifyEmailBody } from '@notefinder/contracts';
import { OTP_LENGTH } from '@notefinder/contracts/auth-rules';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useRouter } from '@/lib/i18n/navigation';
import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import { lazyResolver } from '../lazy-resolver';
import { authHref } from '../redirect-to';
import { FormAlert } from './form-alert';
import { ResendCodeButton } from './resend-code-button';
import { StepHeader } from './step-header';
import { SubmitButton } from './submit-button';
import { TextLink } from './text-link';

const verifyEmailResolver = lazyResolver<VerifyEmailBody>(() =>
  import('@notefinder/contracts').then((m) => m.verifyEmailBodySchema),
);

const SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);
const SLOT_GROUPS = [
  SLOTS.slice(0, OTP_LENGTH / 2),
  SLOTS.slice(OTP_LENGTH / 2),
];

type Notice = { tone: 'error'; code: AuthErrorCode } | { tone: 'success' };

function CodeSlots({ invalid }: { invalid: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      {SLOT_GROUPS.map((group) => (
        <InputOTPGroup key={group[0]}>
          {group.map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              aria-invalid={invalid || undefined}
            />
          ))}
        </InputOTPGroup>
      ))}
    </div>
  );
}

function CodeInput({
  form,
  label,
  invalid,
  onComplete,
}: {
  form: UseFormReturn<VerifyEmailBody>;
  label: string;
  invalid: boolean;
  onComplete: () => void;
}) {
  return (
    <Controller
      control={form.control}
      name="otp"
      render={({ field }) => (
        <InputOTP
          ref={field.ref}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          onComplete={onComplete}
          maxLength={OTP_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-label={label}
        >
          <CodeSlots invalid={invalid} />
        </InputOTP>
      )}
    />
  );
}

function ChangeEmail({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('auth.verifyEmail');

  return (
    <p className="px-4 text-muted-foreground text-sm">
      {t.rich('wrongEmail', {
        link: (chunks) => (
          <TextLink href={authHref('/sign-up', redirectTo)}>{chunks}</TextLink>
        ),
      })}
    </p>
  );
}

export function VerifyEmailForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const t = useTranslations('auth');
  const tErrors = useTranslations('authErrors');
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const form = useForm<VerifyEmailBody>({
    resolver: verifyEmailResolver,
    defaultValues: { email, otp: '' },
  });
  // Load validation now, so it is ready (and in order) on the first blur.
  useEffect(() => {
    verifyEmailResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    const { error } = await authRequest(() =>
      loadAuthClient().then((client) => client.emailOtp.verifyEmail(values)),
    );
    if (error) {
      setNotice({ tone: 'error', code: authErrorCode(error) });
      form.setValue('otp', '');
      form.setFocus('otp');
      return;
    }
    router.push(authHref('/setup-username', redirectTo));
  });

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        step={2}
        title={t('verifyEmail.title')}
        description={t.rich('verifyEmail.description', {
          email: () => (
            <strong className="wrap-break-word font-semibold text-foreground">
              {email}
            </strong>
          ),
        })}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {notice && (
          <FormAlert tone={notice.tone}>
            {notice.tone === 'error'
              ? tErrors(notice.code)
              : t('verifyEmail.resent')}
          </FormAlert>
        )}
        <CodeInput
          form={form}
          label={t('verifyEmail.codeLabel')}
          invalid={notice?.tone === 'error'}
          onComplete={() => onSubmit()}
        />
        <SubmitButton
          pending={form.formState.isSubmitting}
          disabled={form.watch('otp').length < OTP_LENGTH}
        >
          {t('verifyEmail.submit')}
        </SubmitButton>
      </form>
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-2">
        <ResendCodeButton
          email={email}
          onSent={() => setNotice({ tone: 'success' })}
          onError={(code) => setNotice({ tone: 'error', code })}
        />
        <ChangeEmail redirectTo={redirectTo} />
      </div>
    </div>
  );
}
