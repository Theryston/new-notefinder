type FakeTrackProcessing = {
  status: string;
  failureCode?: string | null;
  resumeFrom?: string | null;
  retryable?: boolean;
  video?: { id: string; source: 'musicbrainz' | 'youtube_music' } | null;
};

type FakeLyricLine = {
  start: number;
  end: number;
  words: { text: string; start: number; end: number }[];
};

export type FakeTrack = {
  id: string;
  title: string;
  coverUrl?: string | null;
  /**
   * The artist credit as the Recording printed it, stored at creation;
   * `artistId` is the Artist page a name links to.
   */
  artistCredit?: { name: string; joinPhrase: string; artistId?: string }[];
  /** The length in milliseconds the practice header shows; null by default. */
  durationMs?: number | null;
  youtubeVideoId?: string | null;
  viewCount?: number;
  recommendations?: FakeTrack[];
  recommendationsDelayMs?: number;
  /** The vocal notes in sung order; a Track without any is an instrumental. */
  notes?: { pitch: number; start: number; end: number }[];
  /** The vocal range (MIDI numbers) and key the header shows; absent by default. */
  vocalRange?: { lowest: number; highest: number };
  key?: { tonic: number; mode: 'MAJOR' | 'MINOR' };
  /** Makes the notes request fail (400), to test the timeline's error state. */
  notesFail?: boolean;
  /** The Timed lyrics in sung order; none by default. */
  lyrics?: FakeLyricLine[];
  /** `null` for a Track that never had a Processing. */
  processing: FakeTrackProcessing | null;
  contributors?: {
    id: string;
    username: string | null;
    name: string;
    image: string | null;
  }[];
};
