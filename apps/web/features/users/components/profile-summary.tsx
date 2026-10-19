import type { PublicProfileSummary } from '@notefinder/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  PROFILE_SUMMARY_FIELDS,
  PROFILE_SUMMARY_STATS,
} from '@/features/users/profile-summary-stats';
import {
  getOwnPublicProfileSummary,
  getPublicProfileSummary,
} from '@/features/users/queries';
import { getSectionVisibilityLabels } from '@/features/users/section-visibility-labels';
import { viewerOwnsProfile } from '@/features/users/viewer-owns-profile';
import {
  ProfileSectionScope,
  SectionVisibilityToggle,
} from './profile-section-scope';

/**
 * The Summary section of a Profile: the streak and the counters, as large
 * numbers without boxes (draft "A"). The numbers are read on each request
 * inside a Suspense boundary, so the banner above stays cached. A section the
 * owner hid is left out for visitors and shown dimmed to the owner. When the
 * numbers cannot be read the section is left out, as a section with no content
 * is; the failure is logged on the server, the page stays up.
 */
export async function ProfileSummary({ username }: { username: string }) {
  const visitorSummary = await getPublicProfileSummary(username).catch(
    (error: unknown) => {
      console.error('The Profile summary could not be read', error);
      return undefined;
    },
  );
  if (visitorSummary === undefined) {
    return null;
  }
  if (visitorSummary !== null) {
    return (
      <ProfileSummaryContent username={username} summary={visitorSummary} />
    );
  }
  // Hidden for visitors, or no such User: only the owner still sees it.
  if (!(await viewerOwnsProfile(username))) {
    return null;
  }
  const ownSummary = await getOwnPublicProfileSummary(username).catch(
    () => null,
  );
  if (ownSummary === null) {
    return null;
  }
  return (
    <ProfileSummaryContent
      username={username}
      summary={ownSummary}
      hiddenOnServer
    />
  );
}

async function ProfileSummaryContent({
  username,
  summary,
  hiddenOnServer = false,
}: {
  username: string;
  summary: PublicProfileSummary;
  hiddenOnServer?: boolean;
}) {
  const [t, format, labels] = await Promise.all([
    getTranslations('publicProfile.summary'),
    getFormatter(),
    getSectionVisibilityLabels(),
  ]);

  return (
    <ProfileSectionScope
      username={username}
      section="summary"
      hiddenOnServer={hiddenOnServer}
      labels={labels}
    >
      <section
        aria-labelledby="profile-summary-title"
        className="flex flex-col gap-6"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="profile-summary-title"
            className="font-bold text-2xl tracking-tight"
          >
            {t('title')}
          </h2>
          <SectionVisibilityToggle />
        </header>
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
    </ProfileSectionScope>
  );
}
