import type { BootstrapState } from './bootstrap.repository.js';
import { planRestore } from './restore-plan.js';

const state = (overrides: Partial<BootstrapState>): BootstrapState => ({
  phase: 'restoring',
  dataset: 'tiny',
  ...overrides,
});

describe('planRestore', () => {
  it('restores from scratch when nothing was ever recorded', () => {
    expect(planRestore(undefined, 'tiny')).toBe('fresh');
  });

  it('redoes an interrupted restore instead of resuming it', () => {
    expect(planRestore(state({ phase: 'restoring' }), 'tiny')).toBe('redo');
  });

  it.each(['restored', 'indexing', 'ready'] as const)(
    'skips a %s catalog built from the configured dataset',
    (phase) => {
      expect(planRestore(state({ phase, dataset: 'full' }), 'full')).toBe(
        'skip',
      );
    },
  );

  it.each(['restored', 'indexing', 'ready'] as const)(
    'refuses to switch the dataset of a %s catalog',
    (phase) => {
      expect(planRestore(state({ phase, dataset: 'tiny' }), 'full')).toBe(
        'dataset-changed',
      );
    },
  );

  it('redoes a restoring row even when it names another dataset', () => {
    expect(
      planRestore(state({ phase: 'restoring', dataset: 'full' }), 'tiny'),
    ).toBe('redo');
  });
});
