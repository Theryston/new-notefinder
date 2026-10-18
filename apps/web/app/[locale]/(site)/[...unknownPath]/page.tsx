import { notFound } from 'next/navigation';

/**
 * Any path under the locale that no route matches. `notFound()` renders the
 * `not-found.tsx` of the `(site)` segment: a real 404 status, inside the site
 * layout. The blocking render (`instant = false`) decides the status before
 * anything is sent. Awaiting `params` makes it a request-time render, like the
 * scoped unknown-ID pages; without it the status came back as 200.
 *
 * Cache Components needs at least one static param, so one placeholder path is
 * built. Every other unknown path is rendered on request.
 */
export const instant = false;

export function generateStaticParams() {
  return [{ unknownPath: ['not-found'] }];
}

export default async function UnknownPath({
  params,
}: PageProps<'/[locale]/[...unknownPath]'>) {
  await params;
  notFound();
}
