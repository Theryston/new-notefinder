import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import type { CreditedArtistRow } from '../../database/credited-artists.js';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import {
  artist,
  artistCredit,
  artistCreditName,
  artistTag,
} from '../../database/schema/musicbrainz/artist.js';
import {
  recording,
  recordingTag,
} from '../../database/schema/musicbrainz/recording.js';
import {
  medium,
  release,
  releaseCountry,
  releaseGroupTag,
  releaseUnknownCountry,
  track,
} from '../../database/schema/musicbrainz/release.js';
import { genre, tag } from '../../database/schema/musicbrainz/tag.js';
import type { TagVotesRow } from './recording-data.js';
import type {
  PrimaryReleaseRow,
  RecordingSummaryRow,
} from './recording-summary-data.js';

// The summaries of a page of Recordings are read in ONE statement, however
// many there are: every part is a subquery that runs once per Recording and
// hands back a JSON value. Each one mirrors a query of `RecordingRepository`,
// so a summary tells the same story as the full Recording.

// The credited artists in credit order, like `findCreditedArtists`.
const creditedArtists = sql`(
  select coalesce(jsonb_agg(jsonb_build_object(
    'mbid', ${artist.gid},
    'name', ${artist.name},
    'creditedName', ${artistCreditName.name},
    'joinPhrase', ${artistCreditName.joinPhrase}
  ) order by ${artistCreditName.position}), '[]'::jsonb)
  from ${artistCreditName}
  join ${artist} on ${artist.id} = ${artistCreditName.artist}
  where ${artistCreditName.artistCredit} = ${recording.artistCredit}
)`;

// A release event's date as text, written as `formatPartialDate` writes it
// (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`; none without a year), so that comparing
// the texts orders dates the way `getRecording` does.
const dateText = sql`(
  case when event.year is null then null
  else lpad(event.year::text, 4, '0') || case when event.month is null then ''
    else '-' || lpad(event.month::text, 2, '0') || case when event.day is null
      then '' else '-' || lpad(event.day::text, 2, '0') end end end
)`;

// The release `getRecording` lists first: the oldest (a dated release before
// an undated one), then by title and MBID. `collate "C"` compares by code
// point, like the JavaScript side.
const primaryRelease = sql`(
  select jsonb_build_object(
    'mbid', ${release.gid}, 'title', ${release.name}, 'year', first_event.year)
  from ${track}
  join ${medium} on ${medium.id} = ${track.medium}
  join ${release} on ${release.id} = ${medium.release}
  cross join lateral (
    select min(${dateText} collate "C") as date, min(event.year) as year
    from (
      select ${releaseCountry.dateYear} as year,
        ${releaseCountry.dateMonth} as month, ${releaseCountry.dateDay} as day
      from ${releaseCountry}
      where ${releaseCountry.release} = ${release.id}
      union all
      select ${releaseUnknownCountry.dateYear},
        ${releaseUnknownCountry.dateMonth}, ${releaseUnknownCountry.dateDay}
      from ${releaseUnknownCountry}
      where ${releaseUnknownCountry.release} = ${release.id}
    ) event
  ) first_event
  where ${track.recording} = ${recording.id}
  order by first_event.date asc nulls last, ${release.name} collate "C",
    ${release.gid}, ${medium.position}, ${track.position}
  limit 1
)`;

// The genres (tags MusicBrainz also lists as genres) of a Recording's own
// tags, as JSON rows shaped like `TagVotesRow`; null when there are none.
const ownGenres = sql`(
  select jsonb_agg(jsonb_build_object(
    'name', ${tag.name}, 'count', ${recordingTag.count}, 'genreMbid', ${genre.gid}
  )) as genres
  from ${recordingTag}
  join ${tag} on ${tag.id} = ${recordingTag.tag}
  join ${genre} on ${genre.name} = ${tag.name}
  where ${recordingTag.recording} = ${recording.id} and ${recordingTag.count} > 0
)`;

type VotedSource = {
  table: AnyPgTable;
  tagId: AnyPgColumn;
  count: AnyPgColumn;
  /** Picks the rows of the Recording's release groups or artists. */
  where: SQL;
};

// The same, for a level whose votes are added up across the release groups
// or artists of the Recording (`findTagLevels` does it in the same way).
const votedGenres = (source: VotedSource) => sql`(
  select jsonb_agg(jsonb_build_object(
    'name', voted.name, 'count', voted.count, 'genreMbid', voted.genre_mbid
  )) as genres
  from (
    select ${tag.name} as name, sum(${source.count})::int as count,
      ${genre.gid} as genre_mbid
    from ${source.table}
    join ${tag} on ${tag.id} = ${source.tagId}
    join ${genre} on ${genre.name} = ${tag.name}
    where ${source.where}
    group by ${tag.name}, ${genre.gid}
    having sum(${source.count}) > 0
  ) voted
)`;

// A level is only read when the levels before it have no genre: `own` and
// `by_release_group` are the aliases of those levels in the statement below.
const releaseGroupGenres = votedGenres({
  table: releaseGroupTag,
  tagId: releaseGroupTag.tag,
  count: releaseGroupTag.count,
  where: sql`own.genres is null and ${releaseGroupTag.releaseGroup} in (
    select ${release.releaseGroup}
    from ${track}
    join ${medium} on ${medium.id} = ${track.medium}
    join ${release} on ${release.id} = ${medium.release}
    where ${track.recording} = ${recording.id}
  )`,
});

const artistGenres = votedGenres({
  table: artistTag,
  tagId: artistTag.tag,
  count: artistTag.count,
  where: sql`own.genres is null and by_release_group.genres is null
    and ${artistTag.artist} in (
      select ${artistCreditName.artist}
      from ${artistCreditName}
      where ${artistCreditName.artistCredit} = ${recording.artistCredit}
    )`,
});

type SummaryQueryRow = {
  mbid: string;
  title: string;
  lengthMs: number | null;
  disambiguation: string;
  video: boolean;
  artistCreditName: string;
  artists: CreditedArtistRow[];
  primaryRelease: PrimaryReleaseRow | null;
  recordingGenres: TagVotesRow[];
  releaseGroupGenres: TagVotesRow[];
  artistGenres: TagVotesRow[];
};

const toSummaryRow = ({
  recordingGenres,
  releaseGroupGenres: fromReleaseGroups,
  artistGenres: fromArtists,
  ...row
}: SummaryQueryRow): RecordingSummaryRow => ({
  ...row,
  genreLevels: {
    recording: recordingGenres,
    release_group: fromReleaseGroups,
    artist: fromArtists,
  },
});

/**
 * Reads the Recordings a search found, for display. Read-only: the tables
 * belong to mbslave.
 */
export class RecordingSummaryRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /**
   * The summaries of the Recordings with these MBIDs, in no particular order,
   * in one query. An MBID that is not a Recording (anymore) has no row.
   */
  async findByMbids(mbids: readonly string[]): Promise<RecordingSummaryRow[]> {
    const wanted = sql.join(
      mbids.map((mbid) => sql`${mbid}::uuid`),
      sql`, `,
    );
    const result = await this.getDb().execute<SummaryQueryRow>(sql`
      select
        ${recording.gid} as "mbid",
        ${recording.name} as "title",
        ${recording.length} as "lengthMs",
        ${recording.comment} as "disambiguation",
        ${recording.video} as "video",
        ${artistCredit.name} as "artistCreditName",
        ${creditedArtists} as "artists",
        ${primaryRelease} as "primaryRelease",
        coalesce(own.genres, '[]'::jsonb) as "recordingGenres",
        coalesce(by_release_group.genres, '[]'::jsonb) as "releaseGroupGenres",
        coalesce(by_artist.genres, '[]'::jsonb) as "artistGenres"
      from ${recording}
      join ${artistCredit} on ${artistCredit.id} = ${recording.artistCredit}
      left join lateral ${ownGenres} own on true
      left join lateral ${releaseGroupGenres} by_release_group on true
      left join lateral ${artistGenres} by_artist on true
      where ${recording.gid} in (${wanted})
    `);
    return result.rows.map(toSummaryRow);
  }
}
