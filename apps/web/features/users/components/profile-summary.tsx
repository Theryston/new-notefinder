import type { PublicProfileSummary } from '@notefinder/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  PROFILE_SUMMARY_FIELDS,
  PROFILE_SUMMARY_STATS,
} from '@/features/users/profile-summary-stats';
import { getPublicProfileSummary } from '@/features/users/queries';

/**
 * The Summary section of a Profile: the streak and the counters, as large
 * numbers without boxes (draft "A"). The numbers are read on each request
 * inside a Suspense boundary, so the banner above stays cached. When they
 * cannot be read the section is left out, as a section with no content is;
 * the failure is logged on the server, the page stays up.
 */
export async function ProfileSummary({ username }: { username: string }) {
  const summary = await getPublicProfileSummary(username).catch(
    (error: unknown) => {
      console.error('The Profile summary could not be read', error);
      return null;
    },
  );
  if (summary === null) {
    return null;
  }
  return <ProfileSummaryContent summary={summary} />;
}

async function ProfileSummaryContent({
  summary,
}: {
  summary: PublicProfileSummary;
}) {
  const [t, format] = await Promise.all([
    getTranslations('publicProfile.summary'),
    getFormatter(),
  ]);

  return (
    <section
      aria-labelledby="profile-summary-title"
      className="flex flex-col gap-6"
    >
      <h2
        id="profile-summary-title"
        className="font-bold text-2xl tracking-tight"
      >
        {t('title')}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {PROFILE_SUMMARY_STATS.map((stat) => {
          const value = summary[PROFILE_SUMMARY_FIELDS[stat]];
          // The streak is counted in days: its unit is a plural.
          const caption =
            stat === 'streak' ? t('streakUnit', { count: value }) : undefined;
          return (
            <div key={stat} className="flex min-w-0 flex-col gap-1">
              <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {t(stat)}
              </dt>
              <dd className="font-bold font-mono text-4xl text-foreground tabular-nums md:text-5xl">
                {format.number(value)}
              </dd>
              {caption ? (
                <dd className="text-muted-foreground text-xs">{caption}</dd>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
