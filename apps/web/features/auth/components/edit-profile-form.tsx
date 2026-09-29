'use client';

import type {
  ApiErrorCode,
  CurrentUser,
  UpdateMeBody,
} from '@notefinder/contracts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { Spinner } from '@/components/ui/spinner';

import { fieldErrorKey } from '../field-error';
import { lazyResolver } from '../lazy-resolver';
import type { UpdateProfileResult } from '../update-profile';
import { FormAlert } from './form-alert';
import { FormField, fieldErrorProps } from './form-field';
import { ProfileSummary, type ProfileUser } from './profile-summary';
import { ReadOnlyField } from './read-only-field';
import { TextLink } from './text-link';

const updateMeResolver = lazyResolver<UpdateMeBody>(() =>
  import('@notefinder/contracts').then((m) => m.updateMeBodySchema),
);

// The request code failed to load (offline): same message as a server fault.
const LOAD_FAILED: UpdateProfileResult = {
  ok: false,
  code: 'INTERNAL_ERROR',
};

/** The form, its saving and what to do once the API accepts the change. */
function useProfileForm(
  user: ProfileUser,
  onSaved: (user: CurrentUser) => void,
) {
  const t = useTranslations('profile.edit');
  const mutation = useMutation({
    // Loaded on the first save: it needs Zod and the API client, which the
    // page doesn't until then.
    mutationFn: async (body: UpdateMeBody) => {
      const { updateProfile } = await import('../update-profile');
      return updateProfile(body);
    },
  });
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);
  const form = useForm<UpdateMeBody>({
    resolver: updateMeResolver,
    defaultValues: { name: user.name },
  });
  // Load validation now, so it is ready on the first submit.
  useEffect(() => {
    updateMeResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorCode(null);
    const result = await mutation
      .mutateAsync(values)
      .catch((): UpdateProfileResult => LOAD_FAILED);
    if (!result.ok) {
      // The typed Name stays in the field, so the user can just retry.
      setErrorCode(result.code);
      return;
    }
    // Shows the Name as saved (trimmed) and starts a clean form.
    form.reset({ name: result.user.name });
    onSaved(result.user);
    toast.success(t('saved'));
  });

  return { form, onSubmit, errorCode };
}

function PasswordRow() {
  const t = useTranslations('profile.edit');
  const tFields = useTranslations('auth.fields');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm leading-snug">
          {tFields('password.label')}
        </p>
        <TextLink href="/forgot-password" className="text-sm">
          {t('changePassword')}
        </TextLink>
      </div>
      <p className="font-medium text-muted-foreground text-xs">
        {t('passwordHint')}
      </p>
    </div>
  );
}

/**
 * The Name is editable; Username, email and password are shown for
 * reference (the password leads to the recovery flow). Saved with
 * `PATCH /v1/me`; `onSaved` gets the updated user.
 */
export function EditProfileForm({
  user,
  onSaved,
}: {
  user: ProfileUser;
  onSaved: (user: CurrentUser) => void;
}) {
  const t = useTranslations('profile.edit');
  const tFields = useTranslations('auth.fields');
  const tErrors = useTranslations('errors');
  const { form, onSubmit, errorCode } = useProfileForm(user, onSaved);
  const nameError = form.formState.errors.name;
  const pending = form.formState.isSubmitting;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <ProfileSummary user={user} />
      {errorCode && <FormAlert>{tErrors(errorCode)}</FormAlert>}
      <FormField
        id="name"
        label={tFields('name.label')}
        error={nameError && tFields(fieldErrorKey('name', nameError.type))}
      >
        <Input
          id="name"
          autoComplete="name"
          placeholder={tFields('name.placeholder')}
          {...fieldErrorProps('name', Boolean(nameError))}
          {...form.register('name')}
        />
      </FormField>
      <ReadOnlyField
        id="username"
        label={tFields('username.label')}
        value={user.username}
        hint={t('usernameHint')}
      />
      <ReadOnlyField
        id="email"
        label={tFields('email.label')}
        value={user.email}
      />
      <PasswordRow />
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-fit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending && <Spinner aria-label={t('saving')} />}
        {t('save')}
      </Button>
      <Toaster />
    </form>
  );
}
