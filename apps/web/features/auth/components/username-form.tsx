'use client';

import type { SetUsernameBody } from '@notefinder/contracts';
import { USERNAME_MAX_LENGTH } from '@notefinder/contracts/auth-rules';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { type UseFormRegisterReturn, useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { useRouter } from '@/lib/i18n/navigation';
import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import { fieldErrorKey } from '../field-error';
import { lazyResolver } from '../lazy-resolver';
import { normalizeUsernameInput, suggestUsername } from '../username';
import { FormAlert } from './form-alert';
import { FormField } from './form-field';
import { StepHeader } from './step-header';
import { SubmitButton } from './submit-button';
import {
  AvailabilityHint,
  useUsernameAvailability,
} from './username-availability';

const usernameResolver = lazyResolver<SetUsernameBody>(() =>
  import('@notefinder/contracts').then((m) => m.setUsernameBodySchema),
);

function UsernameInput({
  registration,
  placeholder,
  invalid,
}: {
  registration: UseFormRegisterReturn<'username'>;
  placeholder: string;
  invalid: boolean;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-medium text-muted-foreground"
      >
        @
      </span>
      <Input
        id="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={USERNAME_MAX_LENGTH}
        placeholder={placeholder}
        className="pl-8"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'username-error' : undefined}
        {...registration}
        onChange={(event) => {
          event.target.value = normalizeUsernameInput(event.target.value);
          return registration.onChange(event);
        }}
      />
    </div>
  );
}

export function UsernameForm({
  name,
  redirectTo,
}: {
  name: string;
  redirectTo: string;
}) {
  const t = useTranslations('auth');
  const tErrors = useTranslations('authErrors');
  const router = useRouter();
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const [suggestion] = useState(() => suggestUsername(name));
  const form = useForm<SetUsernameBody>({
    resolver: usernameResolver,
    mode: 'onChange',
    defaultValues: { username: suggestion },
  });
  // Load validation now, so it is ready (and in order) on the first blur.
  useEffect(() => {
    usernameResolver.preload().catch(() => {});
  }, []);
  const username = form.watch('username');
  const fieldError = form.formState.errors.username;
  const availability = useUsernameAvailability(fieldError ? '' : username);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await authRequest(() =>
      loadAuthClient().then((client) => client.updateUser(values)),
    );
    if (result.error) {
      setError(authErrorCode(result.error));
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  });

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        step={3}
        overline={t('setupUsername.welcome', {
          name: name.split(' ')[0] ?? name,
        })}
        title={t('setupUsername.title')}
        description={t('setupUsername.description')}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{tErrors(error)}</FormAlert>}
        <FormField
          id="username"
          label={t('fields.username.label')}
          error={
            fieldError &&
            t(`fields.${fieldErrorKey('username', fieldError.type)}`)
          }
          hint={
            <AvailabilityHint username={username} availability={availability} />
          }
        >
          <UsernameInput
            registration={form.register('username')}
            placeholder={t('fields.username.placeholder')}
            invalid={Boolean(fieldError)}
          />
        </FormField>
        <SubmitButton
          pending={form.formState.isSubmitting}
          disabled={availability === 'taken'}
          className="mt-1"
        >
          {t('setupUsername.submit')}
        </SubmitButton>
      </form>
    </div>
  );
}
