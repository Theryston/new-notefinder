import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../../src/database/database.js';
import {
  ensureNamed,
  type FixtureArtist,
  type FixtureRecording,
  insertRow,
  insertRowWithId,
} from './musicbrainz.js';

// More of the MusicBrainz fixture (see musicbrainz.ts): what a Recording is
// related to. Names that MusicBrainz keeps in small lookup tables (release
// status, primary type, link type, tag) are created on first use.

/** One release event; any part of the date may be left out. */
type ReleaseEventInput = {
  /** ISO 3166-1 alpha-2 code; left out for an unknown country. */
  country?: string;
  year?: number;
  month?: number;
  day?: number;
};

export type FixtureRelease = {
  id: number;
  mbid: string;
  releaseGroup: { id: number; mbid: string };
};

export type ReleaseInput = {
  name: string;
  /** The artist credit the release is credited to. */
  artistCredit: number;
  mbid?: string;
  releaseGroupMbid?: string;
  /** Album, Single, EP, ... */
  primaryType?: string;
  /** Official, Promotion, ... */
  status?: string;
  events?: readonly ReleaseEventInput[];
};

/** A country area with its ISO 3166-1 code, created on first use. */
const ensureCountry = async (db: Database, code: string): Promise<number> => {
  const found = await db.execute<{ area: number }>(
    sql`select area from musicbrainz.iso_3166_1 where code = ${code}`,
  );
  const existing = found.rows[0]?.area;
  if (existing !== undefined) {
    return existing;
  }
  const area = await insertRowWithId(db, 'area', {
    gid: randomUUID(),
    name: `Country ${code}`,
  });
  await insertRow(db, 'iso_3166_1', { area, code });
  await insertRow(db, 'country_area', { area });
  return area;
};

const addReleaseEvent = async (
  db: Database,
  release: number,
  event: ReleaseEventInput,
): Promise<void> => {
  const date = {
    date_year: event.year ?? null,
    date_month: event.month ?? null,
    date_day: event.day ?? null,
  };
  if (event.country === undefined) {
    await insertRow(db, 'release_unknown_country', { release, ...date });
    return;
  }
  const country = await ensureCountry(db, event.country);
  await insertRow(db, 'release_country', { release, country, ...date });
};

export const addRelease = async (
  db: Database,
  input: ReleaseInput,
): Promise<FixtureRelease> => {
  const releaseGroupMbid = input.releaseGroupMbid ?? randomUUID();
  const type =
    input.primaryType === undefined
      ? null
      : await ensureNamed(db, 'release_group_primary_type', input.primaryType, {
          gid: randomUUID(),
        });
  const releaseGroup = await insertRowWithId(db, 'release_group', {
    gid: releaseGroupMbid,
    name: input.name,
    artist_credit: input.artistCredit,
    type,
  });
  const status =
    input.status === undefined
      ? null
      : await ensureNamed(db, 'release_status', input.status, {
          gid: randomUUID(),
        });
  const releaseMbid = input.mbid ?? randomUUID();
  const id = await insertRowWithId(db, 'release', {
    gid: releaseMbid,
    name: input.name,
    artist_credit: input.artistCredit,
    release_group: releaseGroup,
    status,
  });
  for (const event of input.events ?? []) {
    await addReleaseEvent(db, id, event);
  }
  return {
    id,
    mbid: releaseMbid,
    releaseGroup: { id: releaseGroup, mbid: releaseGroupMbid },
  };
};

export type TrackInput = {
  release: FixtureRelease;
  recording: FixtureRecording;
  /** Defaults to the first medium. */
  mediumPosition?: number;
  /** Defaults to the first track. */
  position?: number;
};

/** Puts the Recording on a track of the release, adding the medium if new. */
export const addTrack = async (
  db: Database,
  input: TrackInput,
): Promise<void> => {
  const mediumPosition = input.mediumPosition ?? 1;
  const position = input.position ?? 1;
  const existing = await db.execute<{ id: number }>(
    sql`select id from musicbrainz.medium
      where release = ${input.release.id} and position = ${mediumPosition}`,
  );
  const medium =
    existing.rows[0]?.id ??
    (await insertRowWithId(db, 'medium', {
      release: input.release.id,
      position: mediumPosition,
      gid: randomUUID(),
    }));
  await insertRow(db, 'track', {
    gid: randomUUID(),
    recording: input.recording.id,
    medium,
    position,
    number: String(position),
    name: 'Track',
    artist_credit: input.recording.artistCredit,
  });
};

/** Links the Recording to a new Work (a performance relationship). */
export const addWork = async (
  db: Database,
  recording: FixtureRecording,
  input: { name: string; mbid?: string },
): Promise<void> => {
  const work = await insertRowWithId(db, 'work', {
    gid: input.mbid ?? randomUUID(),
    name: input.name,
  });
  await insertRelationship(db, {
    table: 'l_recording_work',
    linkType: { name: 'performance', entityType1: 'work' },
    entity0: recording.id,
    entity1: work,
  });
};

/** Links the Recording to an external URL with the given relationship name. */
export const addExternalUrl = async (
  db: Database,
  recording: FixtureRecording,
  input: { url: string; linkType: string },
): Promise<void> => {
  const url = await insertRowWithId(db, 'url', {
    gid: randomUUID(),
    url: input.url,
  });
  await insertRelationship(db, {
    table: 'l_recording_url',
    linkType: { name: input.linkType, entityType1: 'url' },
    entity0: recording.id,
    entity1: url,
  });
};

type RelationshipInput = {
  table: 'l_recording_work' | 'l_recording_url';
  linkType: { name: string; entityType1: string };
  entity0: number;
  entity1: number;
};

const insertRelationship = async (
  db: Database,
  input: RelationshipInput,
): Promise<void> => {
  const { name, entityType1 } = input.linkType;
  const linkType = await ensureNamed(db, 'link_type', name, {
    gid: randomUUID(),
    entity_type0: 'recording',
    entity_type1: entityType1,
    link_phrase: name,
    reverse_link_phrase: name,
    long_link_phrase: name,
  });
  const link = await insertRowWithId(db, 'link', { link_type: linkType });
  await insertRow(db, input.table, {
    link,
    entity0: input.entity0,
    entity1: input.entity1,
  });
};

/** Lists `name` as a genre (the tags that are genres are matched by name). */
export const addGenre = async (
  db: Database,
  input: { name: string; mbid: string },
): Promise<void> => {
  await insertRow(db, 'genre', { gid: input.mbid, name: input.name });
};

type TaggedEntity =
  | { recording: FixtureRecording }
  | { releaseGroup: FixtureRelease['releaseGroup'] }
  | { artist: FixtureArtist };

/** Gives a Recording, a release group or an artist `count` votes for a tag. */
export const addTag = async (
  db: Database,
  entity: TaggedEntity,
  tag: { name: string; count: number },
): Promise<void> => {
  const tagId = await ensureNamed(db, 'tag', tag.name);
  if ('recording' in entity) {
    await insertRow(db, 'recording_tag', {
      recording: entity.recording.id,
      tag: tagId,
      count: tag.count,
    });
  } else if ('releaseGroup' in entity) {
    await insertRow(db, 'release_group_tag', {
      release_group: entity.releaseGroup.id,
      tag: tagId,
      count: tag.count,
    });
  } else {
    await insertRow(db, 'artist_tag', {
      artist: entity.artist.id,
      tag: tagId,
      count: tag.count,
    });
  }
};
