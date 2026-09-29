import type { SessionUser } from '../session';
import { UserAvatar } from './user-avatar';

/** The signed-in user once they have chosen a username. */
export type ProfileUser = Omit<SessionUser, 'username'> & { username: string };

/** Who is being edited: their Avatar (or initials), Name and Username. */
export function ProfileSummary({ user }: { user: ProfileUser }) {
  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        user={user}
        className="size-20 *:data-[slot=avatar-fallback]:text-2xl"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold text-lg">{user.name}</p>
        <p className="truncate text-muted-foreground text-sm">
          @{user.username}
        </p>
      </div>
    </div>
  );
}
