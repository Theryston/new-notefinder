import { cn } from '@/lib/utils';

import { artistInitials } from '../artist-initials';

/**
 * The circular avatar of an Artist. The catalog holds no artist images, so
 * the name's initials stand in (the same visual as the artist header, on a
 * neutral fill instead of the orange banner). The caller sizes the circle
 * and its text together.
 */
export function ArtistAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-muted-foreground',
        className,
      )}
    >
      {artistInitials(name)}
    </span>
  );
}
