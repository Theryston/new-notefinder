import type { PublicProfileSummary } from '@notefinder/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  PROFILE_SUMMARY_FIELDS,
  type ProfileSummaryStat,
  shownSummaryStats,
} from '@/features/users/profile-summary-stats';
import {
  getOwnPublicProfileSummary,
  getPublicProfileSummary,
} from '@/features/users/queries';
import { getSectionVisibilityLabels } from '@/features/users/section-visibility-labels';
import { viewerOwnsProfile } from '@/features/users/viewer-owns-profile';
import { OwnerSectionUnavailable } from './owner-section-unavailable';
import {
  ProfileSectionScope,
  SectionVisibilityToggle,
} from './profile-section-scope';

/**
 * The Summary section of a Profile: the streak and the counters, as large
 * numbers without boxes (draft "A"). The numbers are read on each request
 * inside a Suspense boundary, so the banner above stays cached. A section the
 * owner hid is left out for visitors and shown dimmed to the owner; a read
 * the owner cannot get is said so, never left as a gap. A counter the API
 * withheld is left out of the list. The failure is logged on the server, the
 * page stays up.
 */
export async function ProfileSummary({ username }: { username: string }) {
  const visitorSummary = await getPublicProfileSummary(username).catch(
    (error: unknown) => {
      console.error('The Profile summary could not be read', error);
      return undefined;
    },
  );
  if (visitorSummary) {
    return (
      <ProfileSummaryContent username={username} summary={visitorSummary} />
    );
  }
  // Hidden for visitors, no such User, or unreadable: only the owner can still
  // see it, and only the owner's answer decides what they are shown.
  if (!(await viewerOwnsProfile(username))) {
    return null;
  }
  const ownSummary = await getOwnPublicProfileSummary(username).catch(
    (error: unknown) => {
      console.error('The owner’s Profile summary could not be read', error);
      return undefined;
    },
  );
  if (ownSummary === undefined) {
    return <SummaryUnavailable username={username} />;
  }
  if (ownSummary === null) {
    return null;
  }
  return (
    <ProfileSummaryContent
      username={username}
      summary={ownSummary}
      hiddenForVisitors={visitorSummary === null}
    />
  );
}

async function SummaryUnavailable({ username }: { username: string }) {
  const t = await getTranslations('publicProfile.summary');
  return (
    <OwnerSectionUnavailable
      username={username}
      section="summary"
      title={t('title')}
    />
  );
}

async function ProfileSummaryContent({
  username,
  summary,
  hiddenForVisitors = false,
}: {
  username: string;
  summary: PublicProfileSummary;
  hiddenForVisitors?: boolean;
}) {
  const [t, labels] = await Promise.all([
    getTranslations('publicProfile.summary'),
    getSectionVisibilityLabels(),
  ]);

  return (
    <ProfileSectionScope
      username={username}
      section="summary"
      hiddenForVisitors={hiddenForVisitors}
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
        <SummaryStats summary={summary} />
      </section>
    </ProfileSectionScope>
  );
}

/** The numbers, as large figures. A counter the API withheld is not drawn. */
async function SummaryStats({ summary }: { summary: PublicProfileSummary }) {
  const [t, format] = await Promise.all([
    getTranslations('publicProfile.summary'),
    getFormatter(),
  ]);
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
      {shownSummaryStats(summary).map((stat) => (
        <SummaryStat
          key={stat}
          stat={stat}
          summary={summary}
          label={t(stat)}
          // The streak is counted in days: its unit is a plural.
          caption={
            stat === 'streak'
              ? t('streakUnit', { count: summary.streakDays })
              : undefined
          }
          format={format}
        />
      ))}
    </dl>
  );
}

/** One stat: its label, its number and, for the streak, its unit. */
function SummaryStat({
  stat,
  summary,
  label,
  caption,
  format,
}: {
  stat: ProfileSummaryStat;
  summary: PublicProfileSummary;
  label: string;
  caption: string | undefined;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  const value = summary[PROFILE_SUMMARY_FIELDS[stat]];
  if (value === null) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </dt>
      <dd className="font-bold font-mono text-4xl text-foreground tabular-nums md:text-5xl">
        {format.number(value)}
      </dd>
      {caption ? (
        <dd className="text-muted-foreground text-xs">{caption}</dd>
      ) : null}
    </div>
  );
}
