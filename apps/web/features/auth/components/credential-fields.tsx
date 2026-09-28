'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import { fieldErrorKey } from '../field-error';
import { FormField, fieldErrorProps } from './form-field';
import { PasswordInput } from './password-input';
import { PasswordStrengthMeter } from './password-strength-meter';

/** A field's registration and the type of its current validation error. */
type CredentialFieldProps = {
  registration: UseFormRegisterReturn;
  errorType: string | undefined;
};

/** The email input of sign-up and password reset. */
export function EmailField({ registration, errorType }: CredentialFieldProps) {
  const t = useTranslations('auth.fields');

  return (
    <FormField
      id="email"
      label={t('email.label')}
      error={errorType && t(fieldErrorKey('email', errorType))}
    >
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={t('email.placeholder')}
        {...fieldErrorProps('email', errorType !== undefined)}
        {...registration}
      />
    </FormField>
  );
}

/** A password being chosen (sign-up, reset), with its strength meter. */
export function NewPasswordField({
  registration,
  errorType,
  password,
  label,
}: CredentialFieldProps & { password: string; label?: ReactNode }) {
  const t = useTranslations('auth.fields');

  return (
    <FormField
      id="password"
      label={label ?? t('password.label')}
      error={errorType && t(fieldErrorKey('password', errorType))}
      hint={<PasswordStrengthMeter password={password} />}
    >
      <PasswordInput
        id="password"
        autoComplete="new-password"
        placeholder={t('password.placeholder')}
        {...fieldErrorProps('password', errorType !== undefined)}
        {...registration}
      />
    </FormField>
  );
}
