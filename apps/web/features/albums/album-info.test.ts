import { describe, expect, it } from 'vitest';

import { type AlbumInfoLabels, albumInfoItems } from './album-info';

// Labels that name their key, so a test can see which translation was used.
const labels: AlbumInfoLabels = {
  primaryType: (key) => `primary:${key}`,
  secondaryType: (key) => `secondary:${key}`,
};

const album = {
  primaryType: 'Album',
  secondaryTypes: [] as string[],
  year: 1975 as number | null,
};

describe('albumInfoItems', () => {
  it('lists the translated primary type, then the year', () => {
    expect(albumInfoItems(album, labels)).toEqual(['primary:album', '1975']);
  });

  it('puts the translated secondary types between the type and the year', () => {
    expect(
      albumInfoItems(
        { ...album, secondaryTypes: ['Live', 'Compilation'] },
        labels,
      ),
    ).toEqual([
      'primary:album',
      'secondary:live',
      'secondary:compilation',
      '1975',
    ]);
  });

  it('maps every known MusicBrainz primary type to its translation key', () => {
    const keys = ['Album', 'Single', 'EP', 'Broadcast', 'Other'].map(
      (primaryType) =>
        albumInfoItems({ ...album, primaryType, year: null }, labels)[0],
    );

    expect(keys).toEqual([
      'primary:album',
      'primary:single',
      'primary:ep',
      'primary:broadcast',
      'primary:other',
    ]);
  });

  it('maps the MusicBrainz secondary type names to translation keys', () => {
    const items = albumInfoItems(
      {
        primaryType: null,
        secondaryTypes: [
          'Compilation',
          'Soundtrack',
          'Spokenword',
          'Interview',
          'Audiobook',
          'Audio drama',
          'Live',
          'Remix',
          'DJ-mix',
          'Mixtape/Street',
          'Demo',
          'Field recording',
        ],
        year: null,
      },
      labels,
    );

    expect(items).toEqual([
      'secondary:compilation',
      'secondary:soundtrack',
      'secondary:spokenword',
      'secondary:interview',
      'secondary:audiobook',
      'secondary:audioDrama',
      'secondary:live',
      'secondary:remix',
      'secondary:djMix',
      'secondary:mixtapeStreet',
      'secondary:demo',
      'secondary:fieldRecording',
    ]);
  });

  it('shows an unknown primary or secondary type as MusicBrainz names it', () => {
    expect(
      albumInfoItems(
        { primaryType: 'Karaoke', secondaryTypes: ['Dubstep'], year: null },
        labels,
      ),
    ).toEqual(['Karaoke', 'Dubstep']);
  });

  it('leaves out the parts that are unknown', () => {
    expect(
      albumInfoItems(
        { primaryType: null, secondaryTypes: [], year: null },
        labels,
      ),
    ).toEqual([]);
    expect(
      albumInfoItems(
        { primaryType: null, secondaryTypes: [], year: 2000 },
        labels,
      ),
    ).toEqual(['2000']);
  });

  it('does not treat inherited object keys as known types', () => {
    expect(
      albumInfoItems(
        { primaryType: 'constructor', secondaryTypes: [], year: null },
        labels,
      ),
    ).toEqual(['constructor']);
  });
});
