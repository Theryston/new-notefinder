import type { ReleaseWithEvents } from './release-group-data.js';
import { pickRepresentativeRelease } from './representative-release.js';

const mbid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const release = (
  fields: Pick<ReleaseWithEvents, 'id' | 'mbid'> &
    Partial<Omit<ReleaseWithEvents, 'id' | 'mbid'>>,
): ReleaseWithEvents => ({
  title: 'A Night at the Opera',
  status: 'Official',
  events: [],
  ...fields,
});

const dated = (year: number, month?: number, day?: number) => ({
  year,
  month: month ?? null,
  day: day ?? null,
});

describe('pickRepresentativeRelease', () => {
  it('picks the Official release with the earliest release event', () => {
    const later = release({ id: 1, mbid: mbid(1), events: [dated(2001)] });
    const earlier = release({
      id: 2,
      mbid: mbid(2),
      events: [dated(1999, 5, 3)],
    });

    expect(pickRepresentativeRelease([later, earlier])?.id).toBe(2);
  });

  it("takes a release's earliest event as its date, whatever the order of its events", () => {
    const withEarlyEvent = release({
      id: 1,
      mbid: mbid(1),
      events: [dated(2010), dated(1988, 6, 1)],
    });
    const middle = release({ id: 2, mbid: mbid(2), events: [dated(1995)] });

    expect(pickRepresentativeRelease([middle, withEarlyEvent])?.id).toBe(1);
  });

  it('ignores releases that are not Official, however early they are', () => {
    const bootleg = release({
      id: 1,
      mbid: mbid(1),
      status: 'Bootleg',
      events: [dated(1970)],
    });
    const official = release({ id: 2, mbid: mbid(2), events: [dated(1980)] });

    expect(pickRepresentativeRelease([bootleg, official])?.id).toBe(2);
  });

  it('puts an undated Official release after the dated ones', () => {
    const undated = release({ id: 1, mbid: mbid(1), events: [] });
    const datedRelease = release({
      id: 2,
      mbid: mbid(2),
      events: [dated(2015)],
    });

    expect(pickRepresentativeRelease([undated, datedRelease])?.id).toBe(2);
  });

  it('breaks a tie on the date by the smaller MBID', () => {
    const larger = release({ id: 1, mbid: mbid(20), events: [dated(1990)] });
    const smaller = release({ id: 2, mbid: mbid(10), events: [dated(1990)] });

    expect(pickRepresentativeRelease([larger, smaller])?.id).toBe(2);
  });

  it('breaks a tie between undated releases by the smaller MBID', () => {
    const larger = release({ id: 1, mbid: mbid(20) });
    const smaller = release({ id: 2, mbid: mbid(10) });

    expect(pickRepresentativeRelease([larger, smaller])?.id).toBe(2);
  });

  it('takes a year-only date before a full date of the same year, as the release events do', () => {
    const yearOnly = release({ id: 1, mbid: mbid(1), events: [dated(1975)] });
    const fullDate = release({
      id: 2,
      mbid: mbid(2),
      events: [dated(1975, 11, 21)],
    });

    expect(pickRepresentativeRelease([fullDate, yearOnly])?.id).toBe(1);
  });

  it('answers the same release whatever the order the releases come in', () => {
    const releases = [
      release({ id: 1, mbid: mbid(3), events: [dated(1990)] }),
      release({ id: 2, mbid: mbid(1), events: [dated(1990)] }),
      release({ id: 3, mbid: mbid(2), events: [dated(2001)] }),
    ];

    const forward = pickRepresentativeRelease(releases);
    const backward = pickRepresentativeRelease([...releases].reverse());

    expect(forward?.mbid).toBe(mbid(1));
    expect(backward?.mbid).toBe(forward?.mbid);
  });

  it('falls back to the earliest release of any status when none is Official', () => {
    const bootleg = release({
      id: 1,
      mbid: mbid(1),
      status: 'Bootleg',
      events: [dated(1990)],
    });
    const earliest = release({
      id: 2,
      mbid: mbid(2),
      status: null,
      events: [dated(1975, 4)],
    });

    expect(pickRepresentativeRelease([bootleg, earliest])?.id).toBe(2);
  });

  it('breaks a fallback tie by MBID and puts undated releases last, as for Official ones', () => {
    const undated = release({ id: 1, mbid: mbid(1), status: 'Bootleg' });
    const largerMbid = release({
      id: 2,
      mbid: mbid(9),
      status: 'Promotion',
      events: [dated(2001)],
    });
    const smallerMbid = release({
      id: 3,
      mbid: mbid(3),
      status: 'Bootleg',
      events: [dated(2001)],
    });

    expect(
      pickRepresentativeRelease([undated, largerMbid, smallerMbid])?.id,
    ).toBe(3);
  });

  it('still prefers an Official release to an earlier one of another status', () => {
    const bootleg = release({
      id: 1,
      mbid: mbid(1),
      status: 'Bootleg',
      events: [dated(1970)],
    });
    const official = release({
      id: 2,
      mbid: mbid(2),
      events: [dated(1980)],
    });

    expect(pickRepresentativeRelease([bootleg, official])?.id).toBe(2);
  });

  it('answers nothing for a release group without releases', () => {
    expect(pickRepresentativeRelease([])).toBeUndefined();
  });
});
