import type { ReimportSituation } from './reimport-plan.js';
import { planReimport } from './reimport-plan.js';

// The compatibility rule of the reimport plan: only an mbslave release that
// can support the new schema starts the parallel restore. The yearly schema
// change ships with a new mbslave major (v31 to v32), so an older release,
// the stalled one or an unrelated same-major patch all wait. The plan's own
// spec keeps the happy path; this file pins the rejections.
const stalledOn = (
  stallMbslaveRef: string | null | undefined,
  currentMbslaveRef: string | undefined,
): ReimportSituation => ({
  role: 'restore-container',
  dataset: 'full',
  bootstrapPhase: 'ready',
  stallReason: 'schema-change',
  stallMbslaveRef,
  currentMbslaveRef,
});

describe('planReimport mbslave compatibility', () => {
  it('starts the restore on a newer major than the stalled one', () => {
    expect(planReimport(stalledOn('v31.0.1', 'v32.0.0'))).toBe('start-restore');
  });

  it('waits on a downgrade older than the stalled release', () => {
    expect(planReimport(stalledOn('v31.0.1', 'v30.2.0'))).toBe(
      'waiting-compatible',
    );
  });

  it('waits on an unrelated patch of the stalled major', () => {
    expect(planReimport(stalledOn('v31.0.1', 'v31.0.2'))).toBe(
      'waiting-compatible',
    );
  });

  it('waits on an unrelated minor of the stalled major', () => {
    expect(planReimport(stalledOn('v31.0.1', 'v31.1.0'))).toBe(
      'waiting-compatible',
    );
  });

  it('waits when the running release is not a version tag', () => {
    expect(planReimport(stalledOn('v31.0.1', 'main'))).toBe(
      'waiting-compatible',
    );
  });

  it('waits when the stalled release is not a version tag', () => {
    expect(planReimport(stalledOn('main', 'v32.0.0'))).toBe(
      'waiting-compatible',
    );
  });

  it('starts on any known release when the stall recorded none', () => {
    expect(planReimport(stalledOn(null, 'v32.0.0'))).toBe('start-restore');
    expect(planReimport(stalledOn(undefined, 'v32.0.0'))).toBe('start-restore');
  });

  it('waits on an unknown running release even without a recorded stall', () => {
    expect(planReimport(stalledOn(null, 'unknown'))).toBe('waiting-compatible');
    expect(planReimport(stalledOn(null, undefined))).toBe('waiting-compatible');
  });
});
