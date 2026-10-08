import type { TrackContributor } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { UserAvatar } from '@/features/auth/components/user-avatar';
import { Link } from '@/lib/i18n/navigation';

const CONTRIBUTOR_CLASS =
  'flex items-center gap-2 rounded-full pr-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:text-primary';

function ContributorLabel({ contributor }: { contributor: TrackContributor }) {
  return (
    <>
      <UserAvatar
        user={{
          name: contributor.name,
          username: contributor.username,
          // The session type leaves a missing photo out rather than null.
          image: contributor.image ?? undefined,
        }}
        className="size-10"
      />
      <span className="font-medium text-sm">{contributor.name}</span>
    </>
  );
}

/**
 * The Users who contributed to the Track, in the order they first did. Each one
 * links to their Profile by Username; a contributor without one is shown
 * unlinked.
 */
export function TrackContributors({
  contributors,
}: {
  contributors: TrackContributor[];
}) {
  const t = useTranslations('tracks.processing');

  return (
    <section
      aria-labelledby="track-contributors"
      className="flex flex-col gap-3"
    >
      <h2 id="track-contributors" className="font-bold text-lg tracking-tight">
        {t('contributors.heading')}
      </h2>
      <ul className="flex flex-wrap gap-4">
        {contributors.map((contributor) => (
          <li key={contributor.username ?? contributor.name}>
            {contributor.username === null ? (
              <span className="flex items-center gap-2 pr-2">
                <ContributorLabel contributor={contributor} />
              </span>
            ) : (
              <Link
                href={`/users/${contributor.username}`}
                className={CONTRIBUTOR_CLASS}
              >
                <ContributorLabel contributor={contributor} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
