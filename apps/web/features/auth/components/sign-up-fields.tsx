'use client';

import type { SignUpBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import { fieldErrorKey } from '../field-error';
import { EmailField, NewPasswordField } from './credential-fields';
import { FormField, fieldErrorProps } from './form-field';

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
      <EmailField
        registration={form.register('email')}
        errorType={errors.email?.type}
      />
      <NewPasswordField
        registration={form.register('password')}
        errorType={errors.password?.type}
        password={password}
      />
    </>
  );
}
