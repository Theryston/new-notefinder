'use client';

import type { SignUpBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import { fieldErrorKey } from '../field-error';
import { FormField, fieldErrorProps } from './form-field';
import { PasswordInput } from './password-input';
import { PasswordStrengthMeter } from './password-strength-meter';

/** Name, email and password inputs of the sign-up form. */
export function SignUpFields({ form }: { form: UseFormReturn<SignUpBody> }) {
  const t = useTranslations('auth.fields');
  const { errors } = form.formState;
  const password = form.watch('password') ?? '';

  return (
    <>
      <FormField
        id="name"
        label={t('name.label')}
        error={errors.name && t(fieldErrorKey('name', errors.name.type))}
      >
        <Input
          id="name"
          autoComplete="name"
          placeholder={t('name.placeholder')}
          {...fieldErrorProps('name', Boolean(errors.name))}
          {...form.register('name')}
        />
      </FormField>
      <FormField
        id="email"
        label={t('email.label')}
        error={errors.email && t(fieldErrorKey('email', errors.email.type))}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('email.placeholder')}
          {...fieldErrorProps('email', Boolean(errors.email))}
          {...form.register('email')}
        />
      </FormField>
      <FormField
        id="password"
        label={t('password.label')}
        error={
          errors.password && t(fieldErrorKey('password', errors.password.type))
        }
        hint={<PasswordStrengthMeter password={password} />}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder={t('password.placeholder')}
          {...fieldErrorProps('password', Boolean(errors.password))}
          {...form.register('password')}
        />
      </FormField>
    </>
  );
}
