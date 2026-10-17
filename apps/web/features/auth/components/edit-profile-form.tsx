'use client';

import type {
  ApiErrorCode,
  CurrentUser,
  DailyPracticeTargetSeconds,
  UpdateMeBody,
} from '@notefinder/contracts';
import {
  asDailyPracticeTargetSeconds,
  DEFAULT_DAILY_PRACTICE_TARGET_SECONDS,
} from '@notefinder/contracts/daily-target-rules';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { Spinner } from '@/components/ui/spinner';

import { fieldErrorKey } from '../field-error';
import { lazyResolver } from '../lazy-resolver';
import type { UpdateProfileResult } from '../update-profile';
import { AccountSection } from './account-section';
import {
  AvatarPicker,
  type AvatarPickerState,
  useAvatarPicker,
} from './avatar-picker';
import { DailyTargetPicker } from './daily-target-picker';
import { EditSection } from './edit-section';
import { FormAlert } from './form-alert';
import { FormField, fieldErrorProps } from './form-field';
import { ProfileAvatar, type ProfileUser } from './profile-avatar';

const updateMeResolver = lazyResolver<UpdateMeBody>(() =>
  import('@notefinder/contracts').then((m) => m.updateMeBodySchema),
);

// The request code failed to load (offline): same message as a server fault.
const LOAD_FAILED: UpdateProfileResult = {
  ok: false,
  code: 'INTERNAL_ERROR',
};

/** The stored target as one of the presets: anything else reads as the fallback. */
const asPreset = (
  seconds: number | null | undefined,
): DailyPracticeTargetSeconds =>
  asDailyPracticeTargetSeconds(seconds) ??
  DEFAULT_DAILY_PRACTICE_TARGET_SECONDS;

/** The form, its saving and what to do once the API accepts the change. */
function useProfileForm(
  user: ProfileUser,
  picker: AvatarPickerState,
  initialTarget: DailyPracticeTargetSeconds,
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
  // What the target was when the form (re)started: only a change from it is
  // sent, so an untouched form saves exactly like before.
  const [targetBaseline, setTargetBaseline] =
    useState<DailyPracticeTargetSeconds>(initialTarget);
  const form = useForm<UpdateMeBody>({
    resolver: updateMeResolver,
    defaultValues: {
      name: user.name,
      dailyPracticeTargetSeconds: initialTarget,
    },
  });
  // Load validation now, so it is ready on the first submit.
  useEffect(() => {
    updateMeResolver.preload().catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorCode(null);
    const result = await mutation
      .mutateAsync({
        ...values,
        avatar: picker.file ?? undefined,
        dailyPracticeTargetSeconds:
          values.dailyPracticeTargetSeconds !== targetBaseline
            ? values.dailyPracticeTargetSeconds
            : undefined,
      })
      .catch((): UpdateProfileResult => LOAD_FAILED);
    if (!result.ok) {
      // The typed Name, the picked image and the picked target stay, so the
      // user can just retry.
      setErrorCode(result.code);
      return;
    }
    // Shows the Name and the target as saved and starts a clean form.
    const savedTarget = asPreset(result.user.dailyPracticeTargetSeconds);
    form.reset({
      name: result.user.name,
      dailyPracticeTargetSeconds: savedTarget,
    });
    setTargetBaseline(savedTarget);
    picker.clear();
    onSaved(result.user);
    toast.success(t('saved'));
  });

  return { form, onSubmit, errorCode };
}

/** The editable part: the Avatar and the Name, with the Save that sends them. */
function ProfileSection({
  user,
  dailyTargetSeconds,
  onSaved,
}: {
  user: ProfileUser;
  dailyTargetSeconds: number | null;
  onSaved: (user: CurrentUser) => void;
}) {
  const t = useTranslations('profile.edit');
  const tFields = useTranslations('auth.fields');
  const tErrors = useTranslations('errors');
  const picker = useAvatarPicker();
  const { form, onSubmit, errorCode } = useProfileForm(
    user,
    picker,
    asPreset(dailyTargetSeconds),
    onSaved,
  );
  const nameError = form.formState.errors.name;
  const pending = form.formState.isSubmitting;

  return (
    <EditSection title={t('sections.profile')}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <ProfileAvatar user={user} previewUrl={picker.previewUrl}>
          <AvatarPicker picker={picker} />
        </ProfileAvatar>
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
        <Controller
          name="dailyPracticeTargetSeconds"
          control={form.control}
          render={({ field }) => (
            <DailyTargetPicker
              selected={field.value}
              name={field.name}
              onPick={(seconds) => field.onChange(seconds)}
              onBlur={field.onBlur}
            />
          )}
        />
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
        {/* Out of flow: its empty region would otherwise add a form gap. */}
        <div className="absolute">
          <Toaster />
        </div>
      </form>
    </EditSection>
  );
}

/**
 * The Name, the Avatar and the Daily target are editable, saved together
 * with `PATCH /v1/me` (`onSaved` gets the updated user); Username, email and
 * password are shown for reference below (the password leads to the recovery
 * flow).
 */
export function EditProfileForm({
  user,
  dailyTargetSeconds,
  onSaved,
}: {
  user: ProfileUser;
  dailyTargetSeconds: number | null;
  onSaved: (user: CurrentUser) => void;
}) {
  return (
    // `items-start`: the card keeps its own height beside the taller form.
    <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
      <ProfileSection
        user={user}
        dailyTargetSeconds={dailyTargetSeconds}
        onSaved={onSaved}
      />
      <AccountSection user={user} />
    </div>
  );
}
