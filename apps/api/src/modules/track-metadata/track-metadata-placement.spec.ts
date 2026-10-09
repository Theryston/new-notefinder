import { representativeMedium as medium } from '../../../test/utils/catalog-fixtures.js';
import { albumLayoutOf } from './track-metadata-placement.js';

// The place a Recording takes on an Album, decided from the representative
// release first and the Recording's own release second (ADR 0003).

const RECORDING = 'recording-1';
const OTHER = 'recording-2';

describe('albumLayoutOf', () => {
  it('places the Recording where the representative release has it, with its discs', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(1, '', [OTHER, RECORDING]), medium(2, 'Bonus', [OTHER])],
      ownPlacements: [{ discPosition: 2, trackPosition: 1 }],
    });

    expect(layout).toEqual({
      discs: [
        { position: 1, title: null },
        { position: 2, title: 'Bonus' },
      ],
      placement: { discPosition: 1, trackPosition: 2 },
    });
  });

  it('prefers the representative release over the own release when both have the Recording', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(3, '', [RECORDING])],
      ownPlacements: [{ discPosition: 1, trackPosition: 9 }],
    });

    expect(layout?.placement).toEqual({ discPosition: 3, trackPosition: 1 });
  });

  it('takes the lowest place when the representative release lists the Recording twice', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(1, '', ['x', RECORDING]), medium(2, '', [RECORDING])],
      ownPlacements: [],
    });

    expect(layout?.placement).toEqual({ discPosition: 1, trackPosition: 2 });
  });

  it('falls back to the own release when the representative release lacks the Recording, creating its disc', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(1, 'Main', [OTHER])],
      ownPlacements: [{ discPosition: 2, trackPosition: 4 }],
    });

    expect(layout).toEqual({
      discs: [
        { position: 1, title: 'Main' },
        { position: 2, title: null },
      ],
      placement: { discPosition: 2, trackPosition: 4 },
    });
  });

  it('keeps the representative release disc it already has, with its name', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(1, 'Main', [OTHER]), medium(2, 'Live', [])],
      ownPlacements: [{ discPosition: 2, trackPosition: 1 }],
    });

    expect(layout?.discs).toEqual([
      { position: 1, title: 'Main' },
      { position: 2, title: 'Live' },
    ]);
    expect(layout?.placement).toEqual({ discPosition: 2, trackPosition: 1 });
  });

  it('takes the lowest own placement when the Recording is on several own releases of the group', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [],
      ownPlacements: [
        { discPosition: 2, trackPosition: 1 },
        { discPosition: 1, trackPosition: 7 },
      ],
    });

    expect(layout?.placement).toEqual({ discPosition: 1, trackPosition: 7 });
  });

  it('answers nothing when neither release places the Recording', () => {
    expect(
      albumLayoutOf({
        recordingMbid: RECORDING,
        media: [medium(1, '', [OTHER])],
        ownPlacements: [],
      }),
    ).toBeUndefined();
  });

  it('keeps the discs of the representative release in position order', () => {
    const layout = albumLayoutOf({
      recordingMbid: RECORDING,
      media: [medium(2, 'B', []), medium(1, 'A', [RECORDING])],
      ownPlacements: [],
    });

    expect(layout?.discs.map((disc) => disc.position)).toEqual([1, 2]);
  });
});
