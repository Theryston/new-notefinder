import { describe, expect, it, vi } from 'vitest';

import type { InitialPractice } from './practice-queries';

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));

const { buildPracticeMetadata } = await import('./practice-metadata');

const siteUrl = new URL('https://notefinder.example');

// Echoes the key and values, so a test sees which message was picked.
const translate = (key: string, values: Record<string, string>) =>
  `${key}|${values.title}|${values.artists}|${values.notes}`;

const practice = (overrides: Partial<InitialPractice['header']> = {}) =>
  ({
    header: {
      id: 'track-1',
      title: 'Under Pressure',
      coverUrl: 'https://images.example.com/cover.webp',
      artistCredit: [
        { name: 'Queen', joinPhrase: ' & ', artistId: 'artist-1' },
        { name: 'David Bowie', joinPhrase: '', artistId: null },
      ],
      durationMs: 248_400,
      youtubeVideoId: null,
      contributors: [],
      contributorCount: 0,
      hasNotes: true,
      ...overrides,
    },
    notes: {
      notes: [
        { pitch: 64, start: 0, end: 1 },
        { pitch: 49, start: 1, end: 2 },
        { pitch: 64, start: 2, end: 3 },
      ],
    },
  }) satisfies InitialPractice;

const build = (value: InitialPractice, locale: 'en' | 'pt-BR' = 'en') =>
  buildPracticeMetadata({ locale, practice: value, siteUrl, translate });

describe('buildPracticeMetadata', () => {
  it('names the song and its artists in the title, and lists the notes in the description', () => {
    const metadata = build(practice());

    expect(metadata.title).toBe(
      'metaTitle|Under Pressure|Queen & David Bowie|C#3, E4',
    );
    expect(metadata.description).toBe(
      'metaDescription|Under Pressure|Queen & David Bowie|C#3, E4',
    );
  });

  it('picks the messages that fit a Track without artists or without notes', () => {
    const noArtists = build(practice({ artistCredit: [] }));
    const noNotes = build({ ...practice(), notes: undefined });
    const neither = build({
      ...practice({ artistCredit: [] }),
      notes: undefined,
    });

    expect(noArtists.title).toMatch(/^metaTitleNoArtists\|/);
    expect(noArtists.description).toMatch(/^metaDescriptionNoArtists\|/);
    expect(noNotes.description).toMatch(/^metaDescriptionNoNotes\|/);
    expect(neither.description).toMatch(/^metaDescriptionNoArtistsNoNotes\|/);
  });

  it('describes a Track as an Open Graph music.song', () => {
    const { openGraph } = build(practice(), 'pt-BR');

    expect(openGraph).toMatchObject({
      type: 'music.song',
      url: '/pt-BR/tracks/track-1',
      images: [{ url: 'https://images.example.com/cover.webp' }],
      duration: 248,
      musicians: [new URL('https://notefinder.example/pt-BR/artists/artist-1')],
    });
  });

  it('leaves out the cover and the duration it does not have', () => {
    const { openGraph } = build(practice({ coverUrl: null, durationMs: null }));

    expect(openGraph).toMatchObject({
      images: undefined,
      duration: undefined,
    });
  });

  it('sets the canonical URL and the language alternates', () => {
    expect(build(practice(), 'pt-BR').alternates?.canonical).toBe(
      '/pt-BR/tracks/track-1',
    );
    expect(build(practice()).alternates?.languages).toMatchObject({
      en: '/en/tracks/track-1',
      'pt-BR': '/pt-BR/tracks/track-1',
    });
  });
});
