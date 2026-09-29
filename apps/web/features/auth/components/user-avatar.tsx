import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import { initials } from '../initials';
import type { SessionUser } from '../session';

/** The signed-in user's picture, or their initials without one. */
export function UserAvatar({
  user,
  className,
}: {
  user: Pick<SessionUser, 'name' | 'email' | 'username' | 'image'>;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-9', className)}>
      {user.image ? (
        // Decorative: the name is next to it or on the button. Google's photo
        // host refuses some requests that carry a referrer.
        <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-primary/15 font-semibold text-primary">
        {initials(user.name, user.username ?? user.email)}
      </AvatarFallback>
    </Avatar>
  );
}
