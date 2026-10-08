import { missingEntityError } from './missing-entity-error.js';

const MBID = '00000000-0000-4000-8000-000000000301';
const NEW_MBID = '00000000-0000-4000-8000-000000000302';

const ARTIST = {
  label: 'artist',
  notFound: 'ARTIST_NOT_FOUND',
  moved: 'ARTIST_MOVED',
} as const;

describe('missingEntityError', () => {
  it('answers the not-found code when the MBID is unknown', () => {
    const error = missingEntityError(ARTIST, MBID, undefined);

    expect(error.code).toBe('ARTIST_NOT_FOUND');
    expect(error.message).toBe(`No artist has the MBID ${MBID}`);
    expect(error.newMbid).toBeUndefined();
  });

  it('answers the moved code with the MBID the entity was merged into', () => {
    const error = missingEntityError(ARTIST, MBID, NEW_MBID);

    expect(error.code).toBe('ARTIST_MOVED');
    expect(error.message).toBe(
      `The artist ${MBID} was merged into ${NEW_MBID}`,
    );
    expect(error.newMbid).toBe(NEW_MBID);
  });
});
