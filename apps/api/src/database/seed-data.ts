// biome-ignore-all lint/style/noExcessiveLinesPerFile: development fixture (a fictional catalog plus the note generator it feeds); splitting it would scatter the data seed-data.spec.ts checks.
import type { albums } from './schema/albums.js';
import type { artists } from './schema/artists.js';
import type {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from './schema/tracks.js';
import type { users } from './schema/users.js';

/**
 * Deterministic development data for `db:seed`. Everything here is pure (no
 * database access) so it can be unit tested; `seed.ts` writes it.
 */

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

const A4_MIDI = 69;
const A4_FREQUENCY = 440;

/** MIDI number of a note (C4 = 60, A4 = 69). */
export const toMidi = (note: NoteName, octave: number): number =>
  (octave + 1) * 12 + NOTE_NAMES.indexOf(note);

export const fromMidi = (midi: number): { note: NoteName; octave: number } => {
  const pitchClass = ((midi % 12) + 12) % 12;
  const note = NOTE_NAMES[pitchClass];
  if (note === undefined) {
    throw new Error(`Invalid MIDI number: ${midi}`);
  }
  return { note, octave: Math.floor(midi / 12) - 1 };
};

/** Equal-temperament frequency in Hz, tuned to A4 = 440 Hz. */
export const midiToFrequency = (midi: number): number =>
  A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);

export const frequencyToMidi = (frequency: number): number =>
  Math.round(A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY));

/** Small, fast, seedable PRNG (mulberry32) returning floats in [0, 1). */
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export type GeneratedNote = {
  note: NoteName;
  octave: number;
  start: number;
  end: number;
  frequencyMean: number;
};

export type VocalNotesOptions = {
  seed: number;
  durationSeconds: number;
  /** Lowest and highest MIDI numbers the melody may use (the singer's range). */
  lowestMidi: number;
  highestMidi: number;
};

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const between = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

const INTRO_SECONDS = { min: 4, max: 12 };
const OUTRO_SECONDS = 4;
const PHRASE_NOTES = { min: 5, max: 14 };
const REST_SECONDS = { min: 0.6, max: 3 };
// Detune around the exact pitch: real singers are rarely spot on.
const MAX_DETUNE_CENTS = 20;
const MELODY_STEPS = [-3, -2, -2, -1, -1, -1, 0, 0, 1, 1, 1, 2, 2, 3];

const noteLength = (rng: () => number): number => {
  const roll = rng();
  if (roll < 0.55) return between(rng, 0.15, 0.35);
  if (roll < 0.9) return between(rng, 0.35, 0.7);
  return between(rng, 0.7, 1.6);
};

/**
 * Generates a plausible vocal line: phrases of stepwise melody separated by
 * rests. Notes never overlap (each starts at or after the previous end), all
 * fall within the track, and `frequencyMean` stays within
 * {@link MAX_DETUNE_CENTS} cents of the named note.
 */
export const generateVocalNotes = ({
  seed,
  durationSeconds,
  lowestMidi,
  highestMidi,
}: VocalNotesOptions): GeneratedNote[] => {
  const rng = createRng(seed);
  const notes: GeneratedNote[] = [];
  const lastEnd = durationSeconds - OUTRO_SECONDS;
  const center = Math.round((lowestMidi + highestMidi) / 2);

  let time = between(rng, INTRO_SECONDS.min, INTRO_SECONDS.max);
  let midi = center;

  while (time < lastEnd) {
    const phraseLength = Math.floor(
      between(rng, PHRASE_NOTES.min, PHRASE_NOTES.max + 1),
    );
    // Each phrase restarts near the middle of the range, like a new line.
    midi = Math.round((midi + center) / 2);

    for (let index = 0; index < phraseLength; index++) {
      const start = round(time, 3);
      const end = round(time + noteLength(rng), 3);
      if (end > lastEnd) {
        return notes;
      }

      const step = MELODY_STEPS[Math.floor(rng() * MELODY_STEPS.length)] ?? 0;
      midi = Math.min(highestMidi, Math.max(lowestMidi, midi + step));
      const cents = between(rng, -MAX_DETUNE_CENTS, MAX_DETUNE_CENTS);

      notes.push({
        ...fromMidi(midi),
        start,
        end,
        frequencyMean: round(midiToFrequency(midi) * 2 ** (cents / 1200), 2),
      });
      // Mostly legato, with the occasional short breath between notes.
      time = end + (rng() < 0.2 ? between(rng, 0.02, 0.12) : 0);
    }

    time += between(rng, REST_SECONDS.min, REST_SECONDS.max);
  }

  return notes;
};

type UserRow = typeof users.$inferInsert & { id: string };
type ArtistRow = typeof artists.$inferInsert & { id: string };
type AlbumRow = typeof albums.$inferInsert & { id: string };
type TrackRow = typeof tracks.$inferInsert & { id: string };
type TrackArtistRow = typeof trackArtists.$inferInsert & { id: string };
type ThumbnailRow = typeof thumbnails.$inferInsert & { id: string };
type TrackNoteRow = typeof trackNotes.$inferInsert & { id: string };

export type SeedData = {
  users: UserRow[];
  artists: ArtistRow[];
  albums: AlbumRow[];
  tracks: TrackRow[];
  trackArtists: TrackArtistRow[];
  thumbnails: ThumbnailRow[];
  trackNotes: TrackNoteRow[];
};

/**
 * Creator of every seeded track. `seed.ts` also gives it a password
 * (`SEED_USER_PASSWORD`), so developers can sign in right after seeding.
 */
export const SEED_USER = {
  id: 'seeduser01',
  name: 'Seed Creator',
  email: 'seed@notefinder.dev',
  emailVerified: true,
  username: 'seed_creator',
  role: 'USER',
} satisfies UserRow;

// Development only: `assertSeedAllowed` keeps the seed away from production.
export const SEED_USER_PASSWORD = 'notefinder-seed';

// Fictional catalog: YouTube IDs are placeholders, so the embedded player
// won't find these videos, but every page that lists or renders tracks has
// realistic data to show.
const SEED_ARTISTS = [
  { id: 'seedartist01', name: 'Luna Vale', ytId: 'UCseedLunaVale000000000' },
  {
    id: 'seedartist02',
    name: 'Marco Ribeiro',
    ytId: 'UCseedMarcoRibeiro00000',
  },
  {
    id: 'seedartist03',
    name: 'The Paper Lanterns',
    ytId: 'UCseedPaperLanterns0000',
  },
] satisfies ArtistRow[];

const SEED_ALBUMS = [
  { id: 'seedalbum01', name: 'Midnight Letters', ytId: 'MPREseedMidnight01' },
  { id: 'seedalbum02', name: 'Céu Aberto', ytId: 'MPREseedCeuAberto1' },
] satisfies AlbumRow[];

type SeedTrack = TrackRow & {
  artistIds: string[];
  /** Singer's range as MIDI numbers, for tracks that get notes. */
  range?: { lowestMidi: number; highestMidi: number };
};

const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const SEED_TRACKS: SeedTrack[] = [
  {
    id: 'seedtrack01',
    ytId: 'seedGlass01',
    title: 'Glass Horizon',
    status: 'COMPLETED',
    durationSeconds: 214,
    year: 2023,
    isExplicit: false,
    albumId: 'seedalbum01',
    score: 120,
    playingCopyright: ['ALLOW_PLAY', 'ALLOW_TRANSPOSE'],
    artistIds: ['seedartist01'],
    range: { lowestMidi: toMidi('G', 3), highestMidi: toMidi('E', 5) },
  },
  {
    id: 'seedtrack02',
    ytId: 'seedPaper02',
    title: 'Paper Planes at Dawn',
    status: 'COMPLETED',
    durationSeconds: 187,
    year: 2023,
    isExplicit: false,
    albumId: 'seedalbum01',
    score: 85,
    playingCopyright: ['ALLOW_PLAY'],
    artistIds: ['seedartist01', 'seedartist03'],
    range: { lowestMidi: toMidi('A', 3), highestMidi: toMidi('C', 5) },
  },
  {
    id: 'seedtrack03',
    ytId: 'seedMare003',
    title: 'Maré Alta',
    status: 'COMPLETED',
    durationSeconds: 241,
    year: 2021,
    isExplicit: true,
    albumId: 'seedalbum02',
    score: 42,
    playingCopyright: ['ALLOW_PLAY', 'ALLOW_TRANSPOSE', 'ALLOW_VOCALS_ONLY'],
    artistIds: ['seedartist02'],
    range: { lowestMidi: toMidi('G', 2), highestMidi: toMidi('G', 4) },
  },
  {
    id: 'seedtrack04',
    ytId: 'seedLantr04',
    title: 'Lanterns in the Rain',
    status: 'DETECTING_VOCALS_NOTES',
    durationSeconds: 199,
    year: 2024,
    isExplicit: false,
    albumId: null,
    score: 0,
    playingCopyright: [],
    artistIds: ['seedartist03'],
  },
  {
    id: 'seedtrack05',
    ytId: 'seedEstrd05',
    title: 'Estrada de Terra',
    status: 'ERROR',
    statusDescription: 'Vocal extraction failed',
    durationSeconds: 176,
    year: 2021,
    isExplicit: false,
    albumId: 'seedalbum02',
    score: 0,
    playingCopyright: [],
    artistIds: ['seedartist02'],
  },
];

const THUMBNAIL_SIZES = [120, 544];

/** Stable 32-bit hash of a string, used to derive per-track RNG seeds. */
const hashString = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

export const buildSeedData = (): SeedData => {
  const data: SeedData = {
    users: [SEED_USER],
    artists: SEED_ARTISTS,
    albums: SEED_ALBUMS,
    tracks: [],
    trackArtists: [],
    thumbnails: [],
    trackNotes: [],
  };

  for (const { artistIds, range, ...track } of SEED_TRACKS) {
    // Media and lyrics URLs stay null: there are no real files to point at.
    data.tracks.push({
      ...track,
      creatorId: SEED_USER.id,
      duration:
        track.durationSeconds == null
          ? null
          : formatDuration(track.durationSeconds),
      jobId: `seed-job-${track.id}`,
    });

    artistIds.forEach((artistId, index) => {
      data.trackArtists.push({
        id: `${track.id}artist${index + 1}`,
        trackId: track.id,
        artistId,
      });
    });

    for (const size of THUMBNAIL_SIZES) {
      data.thumbnails.push({
        id: `${track.id}thumb${size}`,
        trackId: track.id,
        url: `https://picsum.photos/seed/${track.id}/${size}/${size}`,
        width: size,
        height: size,
      });
    }

    if (range && track.status === 'COMPLETED' && track.durationSeconds) {
      const notes = generateVocalNotes({
        seed: hashString(track.id),
        durationSeconds: track.durationSeconds,
        ...range,
      });
      notes.forEach((note, index) => {
        data.trackNotes.push({
          id: `${track.id}note${String(index + 1).padStart(4, '0')}`,
          trackId: track.id,
          ...note,
        });
      });
    }
  }

  return data;
};

/** The seed writes fake data, so it must never touch a production database. */
export const assertSeedAllowed = (nodeEnv: string): void => {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed the database when NODE_ENV=production');
  }
};
