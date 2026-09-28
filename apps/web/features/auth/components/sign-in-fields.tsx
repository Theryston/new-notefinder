'use client';

import type { SignInBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import { authHref } from '../redirect-to';
import { FormField, fieldErrorProps } from './form-field';
import { PasswordInput } from './password-input';
import { TextLink } from './text-link';

/**
 * Email-or-username and password inputs of the sign-in form. Both are only
 * required, so the one message each can show is "enter it".
 */
export function SignInFields({
  form,
  redirectTo,
}: {
  form: UseFormReturn<SignInBody>;
  redirectTo: string;
}) {
  const t = useTranslations('auth');
  const { errors } = form.formState;

  return (
    <>
      <FormField
        id="emailOrUsername"
        label={t('signIn.emailOrUsername.label')}
        error={errors.emailOrUsername && t('signIn.emailOrUsername.required')}
      >
        <Input
          id="emailOrUsername"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('signIn.emailOrUsername.placeholder')}
          {...fieldErrorProps(
            'emailOrUsername',
            Boolean(errors.emailOrUsername),
          )}
          {...form.register('emailOrUsername')}
        />
      </FormField>
      <FormField
        id="password"
        label={t('fields.password.label')}
        action={
          <TextLink
            href={authHref('/forgot-password', redirectTo)}
            className="text-sm"
          >
            {t('signIn.forgotPassword')}
          </TextLink>
        }
        error={errors.password && t('signIn.password.required')}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder={t('signIn.password.placeholder')}
          {...fieldErrorProps('password', Boolean(errors.password))}
          {...form.register('password')}
        />
      </FormField>
    </>
  );
}
