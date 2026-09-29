'use client';

import type { CurrentUser } from '@notefinder/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import { authKeys } from '../query-keys';
import { authHref } from '../redirect-to';
import { type SessionUser, sessionUserOptions } from '../session';
import { EditProfileForm } from './edit-profile-form';
import { EditProfileSkeleton } from './edit-profile-skeleton';

const EDIT_PROFILE_PATH = '/me/edit';

/**
 * The edit form for the signed-in user, read from the session in the browser
 * (so the page stays static). Signed-out visitors go to sign in and come
 * back; a user missing the username or a verified email keeps the skeleton
 * while `AuthGate` sends them to that step.
 */
export function EditProfile() {
  const { data: user } = useQuery(sessionUserOptions());
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    // `null` is the answer "nobody is signed in"; `undefined` is still
    // loading (or failed), which must not look like being signed out.
    if (user === null) {
      router.replace(authHref('/sign-in', EDIT_PROFILE_PATH));
    }
  }, [user, router]);

  if (!user?.username || !user.emailVerified) return <EditProfileSkeleton />;

  // The header reads the same session, so it shows the saved Name at once.
  const showSaved = (saved: CurrentUser) =>
    queryClient.setQueryData<SessionUser | null>(
      authKeys.session(),
      (current) =>
        current
          ? { ...current, name: saved.name, image: saved.image ?? undefined }
          : current,
    );

  return (
    <EditProfileForm
      user={{ ...user, username: user.username }}
      onSaved={showSaved}
    />
  );
}
