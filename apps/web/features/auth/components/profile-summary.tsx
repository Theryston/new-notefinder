import type { ReactNode } from 'react';

import type { SessionUser } from '../session';
import { UserAvatar } from './user-avatar';

/** The signed-in user once they have chosen a username. */
export type ProfileUser = Omit<SessionUser, 'username'> & { username: string };

/**
 * Who is being edited: their Avatar (or initials), Name and Username.
 * `previewUrl` stands in for the Avatar while a new picture waits to be
 * saved; `children` sit under the Username (the picker).
 */
export function ProfileSummary({
  user,
  previewUrl,
  children,
}: {
  user: ProfileUser;
  previewUrl?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        user={{ ...user, image: previewUrl ?? user.image }}
        className="size-20 *:data-[slot=avatar-fallback]:text-2xl"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-lg">{user.name}</p>
          <p className="truncate text-muted-foreground text-sm">
            @{user.username}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
