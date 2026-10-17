import { ArrowLeftIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type NotFoundViewProps = {
  title: string;
  description: string;
  homeLabel: string;
  searchLabel: string;
  homeHref: string;
  searchHref: string;
};

/**
 * The global 404: a short, centered moment with the error code in the
 * heading (so the existing artist/album e2e that asserts a `404` heading
 * keeps passing), a translated explanation and the two ways out (home and
 * search). One primary button per view region: search is primary, home is
 * secondary on the plain page background.
 */
export function NotFoundView({
  title,
  description,
  homeLabel,
  searchLabel,
  homeHref,
  searchHref,
}: NotFoundViewProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">404 — {title}</h1>
        <p className="max-w-md text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href={homeHref} />}
        >
          <ArrowLeftIcon />
          {homeLabel}
        </Button>
        <Button nativeButton={false} render={<Link href={searchHref} />}>
          <SearchIcon />
          {searchLabel}
        </Button>
      </div>
    </div>
  );
}
