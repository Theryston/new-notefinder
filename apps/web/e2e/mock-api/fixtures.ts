/**
 * Catalog served by the mock API (`server.ts`) to the production build under
 * test: the web server fetches it server side, where Playwright's
 * `page.route` can't reach. Specs import the same data to assert on it.
 *
 * Imported by Node without bundling: relative imports keep the `.ts`
 * extension and only erasable TypeScript is allowed.
 */

export const MOCK_API_PORT = 3333;
const origin = `http://127.0.0.1:${MOCK_API_PORT}`;

type Note = { note: string; octave: number };

type MockTrack = {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  artists: { id: string; name: string }[];
  album: { id: string; name: string } | null;
  thumbnails: { url: string; width: number | null; height: number | null }[];
  vocalRange: { lowest: Note; highest: Note } | null;
};

type MockCollection = {
  owner: { id: string; name: string; trackCount: number };
  /** Pages in order; each one's `nextCursor` is the next index. */
  pages: MockTrack[][];
};

export const coverUrl = (id: string): string => `${origin}/covers/${id}.svg`;

const artist = { id: 'clx456def', name: 'Marília Mendonça' };
const guest = { id: 'guest-artist', name: 'Maiara & Maraisa' };
const album = { id: 'clx789ghi', name: 'Todos os Cantos' };

const track = (index: number, overrides: Partial<MockTrack> = {}) => ({
  id: `track-${index}`,
  title: `Song ${index}`,
  durationSeconds: 180 + index,
  artists: [artist],
  album,
  thumbnails: [
    { url: coverUrl(`track-${index}-small`), width: 120, height: 120 },
    { url: coverUrl(`track-${index}`), width: 544, height: 544 },
  ],
  vocalRange: {
    lowest: { note: 'E', octave: 3 },
    highest: { note: 'A#', octave: 4 },
  },
  ...overrides,
});

const artistTracks = Array.from({ length: 30 }, (_, index) => {
  if (index === 1) return track(index, { artists: [artist, guest] });
  if (index === 2) return track(index, { title: null, vocalRange: null });
  if (index === 3) return track(index, { thumbnails: [] });
  return track(index);
});

export const mockCollections = {
  artist: {
    owner: { ...artist, trackCount: artistTracks.length },
    // Page size 24 (the web's TRACK_PAGE_SIZE), then the rest.
    pages: [artistTracks.slice(0, 24), artistTracks.slice(24)],
  },
  album: {
    owner: { ...album, trackCount: 3 },
    pages: [artistTracks.slice(0, 3)],
  },
  emptyArtist: {
    owner: { id: 'empty-artist', name: 'Nobody Yet', trackCount: 0 },
    pages: [[]],
  },
} satisfies Record<string, MockCollection>;

/** `GET /v1/{artists|albums}/:id[/tracks]` → collection, by path prefix. */
export const mockCollectionsByPath: Record<string, MockCollection> = {
  [`/v1/artists/${mockCollections.artist.owner.id}`]: mockCollections.artist,
  [`/v1/albums/${mockCollections.album.owner.id}`]: mockCollections.album,
  [`/v1/artists/${mockCollections.emptyArtist.owner.id}`]:
    mockCollections.emptyArtist,
};
