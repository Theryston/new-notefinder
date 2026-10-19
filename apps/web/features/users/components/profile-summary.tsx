import type { PublicProfileSummary } from '@notefinder/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getPublicProfileSummary } from '@/features/users/queries';

/**
 * The Summary section of a Profile: the streak and the counters, as large
 * numbers without boxes (draft "A"). The numbers are read on each request
 * inside a Suspense boundary, so the banner above stays cached. When they
 * cannot be read the section is left out, as a section with no content is.
 */
export async function ProfileSummary({ username }: { username: string }) {
  const summary = await getPublicProfileSummary(username).catch(() => null);
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

  const stats = [
    {
      key: 'streak',
      label: t('streak'),
      value: summary.streakDays,
      caption: t('streakUnit', { count: summary.streakDays }),
    },
    { key: 'sung', label: t('sung'), value: summary.sungCount },
    { key: 'favorites', label: t('favorites'), value: summary.favoritesCount },
    {
      key: 'contributions',
      label: t('contributions'),
      value: summary.contributionsCount,
    },
  ];

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
        {stats.map((stat) => (
          <div key={stat.key} className="flex min-w-0 flex-col gap-1">
            <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {stat.label}
            </dt>
            <dd className="font-bold font-mono text-4xl text-foreground tabular-nums md:text-5xl">
              {format.number(stat.value)}
            </dd>
            {stat.caption ? (
              <dd className="text-muted-foreground text-xs">{stat.caption}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
