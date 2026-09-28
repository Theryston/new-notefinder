'use client';

import type { SignUpBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';

import { FieldSeparator } from '@/components/ui/field';
import { useRouter } from '@/lib/i18n/navigation';
import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import { lazyResolver } from '../lazy-resolver';
import { authHref, redirectToFromSearch } from '../redirect-to';
import { browserStorage, rememberCodeSentAt } from '../resend-cooldown';
import { FormAlert } from './form-alert';
import { GoogleButton } from './google-button';
import { SignUpFields } from './sign-up-fields';
import { StepHeader } from './step-header';
import { SubmitButton } from './submit-button';
import { TextLink } from './text-link';

const signUpResolver = lazyResolver<SignUpBody>(() =>
  import('@notefinder/contracts').then((m) => m.signUpBodySchema),
);

const noSubscription = () => () => {};

/**
 * The query string, read after hydration: the page is prerendered once for
 * every visitor, so `redirectTo` and `error` can't be part of its HTML.
 */
function useLocationSearch(): string {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => '',
  );
}

type SignUpError = AuthErrorCode | 'GOOGLE';

export function SignUpForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('authErrors');
  const router = useRouter();
  const search = useLocationSearch();
  const redirectTo = redirectToFromSearch(search);
  const [error, setError] = useState<SignUpError | null>(null);
  const googleFailed = new URLSearchParams(search).has('error');
  const form = useForm<SignUpBody>({
    resolver: signUpResolver,
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });
  // Load validation now, so it is ready (and in order) on the first blur.
  useEffect(() => {
    signUpResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await authRequest(() =>
      loadAuthClient().then((client) => client.signUp.email(values)),
    );
    if (result.error) {
      setError(authErrorCode(result.error));
      return;
    }
    // Sign-up sent the first code: the resend cooldown counts from now.
    rememberCodeSentAt(browserStorage(), values.email, Date.now());
    router.push(authHref('/verify-email', redirectTo, { email: values.email }));
  });

  const shownError = error ?? (googleFailed ? 'GOOGLE' : null);

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        step={1}
        title={t('signUp.title')}
        description={t('signUp.description')}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {shownError && (
          <FormAlert>
            {shownError === 'GOOGLE'
              ? t('signUp.googleError')
              : tErrors(shownError)}
          </FormAlert>
        )}
        <SignUpFields form={form} />
        <SubmitButton
          pending={form.formState.isSubmitting}
          className="mt-1 w-full"
        >
          {t('signUp.submit')}
        </SubmitButton>
      </form>
      <FieldSeparator>{t('signUp.or')}</FieldSeparator>
      <GoogleButton onError={() => setError('GOOGLE')} />
      <p className="text-center text-muted-foreground text-sm">
        {t.rich('signUp.haveAccount', {
          link: (chunks) => (
            <TextLink href={authHref('/sign-in', redirectTo)}>
              {chunks}
            </TextLink>
          ),
        })}
      </p>
    </div>
  );
}
