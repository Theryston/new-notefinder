/**
 * The info line of an album header: its primary type, its secondary types
 * and its first-release year, with the unknown parts left out.
 *
 * MusicBrainz names its types in English. The known names map to a
 * translation key; an unknown name (a type MusicBrainz added later) is shown
 * as MusicBrainz spells it, rather than hidden or mistranslated.
 */

type PrimaryTypeKey = 'album' | 'single' | 'ep' | 'broadcast' | 'other';

type SecondaryTypeKey =
  | 'compilation'
  | 'soundtrack'
  | 'spokenword'
  | 'interview'
  | 'audiobook'
  | 'audioDrama'
  | 'live'
  | 'remix'
  | 'djMix'
  | 'mixtapeStreet'
  | 'demo'
  | 'fieldRecording';

const PRIMARY_TYPE_KEYS = new Map<string, PrimaryTypeKey>([
  ['Album', 'album'],
  ['Single', 'single'],
  ['EP', 'ep'],
  ['Broadcast', 'broadcast'],
  ['Other', 'other'],
]);

const SECONDARY_TYPE_KEYS = new Map<string, SecondaryTypeKey>([
  ['Compilation', 'compilation'],
  ['Soundtrack', 'soundtrack'],
  ['Spokenword', 'spokenword'],
  ['Interview', 'interview'],
  ['Audiobook', 'audiobook'],
  ['Audio drama', 'audioDrama'],
  ['Live', 'live'],
  ['Remix', 'remix'],
  ['DJ-mix', 'djMix'],
  ['Mixtape/Street', 'mixtapeStreet'],
  ['Demo', 'demo'],
  ['Field recording', 'fieldRecording'],
]);

export type AlbumInfoLabels = {
  primaryType: (key: PrimaryTypeKey) => string;
  secondaryType: (key: SecondaryTypeKey) => string;
};

export type AlbumInfo = {
  primaryType: string | null;
  secondaryTypes: string[];
  year: number | null;
};

const labelOf = <Key extends string>(
  value: string,
  keys: Map<string, Key>,
  label: (key: Key) => string,
): string => {
  const key = keys.get(value);
  return key === undefined ? value : label(key);
};

/**
 * The parts of the info line, in display order: primary type, secondary
 * types, year. Empty parts are left out, so the line never shows a blank.
 */
export function albumInfoItems(
  album: AlbumInfo,
  labels: AlbumInfoLabels,
): string[] {
  const items: string[] = [];
  if (album.primaryType) {
    items.push(
      labelOf(album.primaryType, PRIMARY_TYPE_KEYS, labels.primaryType),
    );
  }
  for (const secondary of album.secondaryTypes) {
    items.push(labelOf(secondary, SECONDARY_TYPE_KEYS, labels.secondaryType));
  }
  if (album.year !== null) {
    items.push(String(album.year));
  }
  return items;
}
