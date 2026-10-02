import type { ReimportSituation } from './reimport-plan.js';
import { planReimport } from './reimport-plan.js';
import type { ReimportState } from './reimport-state.repository.js';

const ready: Omit<ReimportSituation, 'role' | 'reimport'> & {
  reimport?: ReimportState;
} = {
  dataset: 'full',
  bootstrapPhase: 'ready',
  stallReason: undefined,
  stallMbslaveRef: undefined,
  currentMbslaveRef: 'v32.0.0',
};

const stalled = (overrides: Partial<ReimportSituation> = {}) => ({
  ...ready,
  stallReason: 'schema-change' as const,
  stallMbslaveRef: 'v31.0.1',
  ...overrides,
});

describe('planReimport', () => {
  it.each(['restore-container', 'worker'] as const)(
    'stays disabled outside full mode (%s)',
    (role) => {
      expect(
        planReimport({
          ...ready,
          role,
          dataset: 'tiny',
          reimport: { phase: 'indexing', progressPct: null, detail: null },
        }),
      ).toBe('disabled');
    },
  );

  it('leaves a catalog that never finished its first import alone', () => {
    expect(
      planReimport({
        ...stalled(),
        role: 'restore-container',
        bootstrapPhase: 'indexing',
      }),
    ).toBe('idle');
    expect(
      planReimport({
        ...stalled(),
        role: 'worker',
        bootstrapPhase: 'restoring',
        reimport: { phase: 'indexing', progressPct: null, detail: null },
      }),
    ).toBe('idle');
  });

  it('waits for the bumped mbslave while the stalled release still runs', () => {
    expect(
      planReimport({
        ...stalled({ currentMbslaveRef: 'v31.0.1' }),
        role: 'restore-container',
      }),
    ).toBe('waiting-compatible');
  });

  it('waits when no release is recorded on either side', () => {
    expect(
      planReimport({
        ...stalled({ currentMbslaveRef: 'unknown', stallMbslaveRef: null }),
        role: 'restore-container',
      }),
    ).toBe('waiting-compatible');
  });

  it('starts the parallel restore once the bumped image runs', () => {
    expect(planReimport({ ...stalled(), role: 'restore-container' })).toBe(
      'start-restore',
    );
    expect(planReimport({ ...stalled(), role: 'worker' })).toBe('idle');
  });

  it('never starts without a schema-change stall', () => {
    expect(planReimport({ ...ready, role: 'restore-container' })).toBe('idle');
  });

  it.each([
    ['restoring', 'continue-restore', 'wait-restore'],
    ['indexing', 'idle', 'run-indexing'],
    ['switching', 'idle', 'run-switch'],
    ['switched', 'idle', 'idle'],
  ] as const)(
    'resumes a %s reimport on the owning side',
    (phase, container, worker) => {
      const reimport = { phase, progressPct: null, detail: null };
      expect(
        planReimport({ ...ready, role: 'restore-container', reimport }),
      ).toBe(container);
      expect(planReimport({ ...ready, role: 'worker', reimport })).toBe(worker);
    },
  );
});
