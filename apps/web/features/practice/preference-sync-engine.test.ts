import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { createPreferenceSync } from './preference-sync-engine';
import { scoringSettings } from './stores/scoring-settings';
import { singingAidsStore } from './stores/singing-aids-store';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const account = {
  difficulty: 'HARD',
  octaveMode: 'EXACT',
  guideMelody: true,
  countIn: false,
} as const;

const resetStores = () => {
  scoringSettings.setState({ difficulty: 'NORMAL', octaveMode: 'ANY' });
  singingAidsStore.setState({
    countIn: true,
    guideMelody: false,
    guideMelodyManual: false,
    offset: 0,
  });
};

describe('createPreferenceSync', () => {
  it('adopts the account values once per account', async () => {
    resetStores();
    mockBrowserApi.mockResolvedValue({ ...account });
    const sync = createPreferenceSync(() => true);

    await sync.adopt('ada@example.com');

    expect(scoringSettings.getState()).toEqual({
      difficulty: 'HARD',
      octaveMode: 'EXACT',
    });
    expect(singingAidsStore.getState()).toMatchObject({
      countIn: false,
      guideMelody: true,
    });
    const calls = mockBrowserApi.mock.calls.length;
    await sync.adopt('ada@example.com');
    expect(mockBrowserApi.mock.calls.length).toBe(calls);
    sync.dispose();
  });

  it('adopts again after signing out and back in', async () => {
    resetStores();
    mockBrowserApi.mockResolvedValue({ ...account });
    const sync = createPreferenceSync(() => true);

    await sync.adopt('ada@example.com');
    sync.signOut();
    scoringSettings.setState({ difficulty: 'EASY', octaveMode: 'ANY' });
    const calls = mockBrowserApi.mock.calls.length;
    await sync.adopt('ada@example.com');

    expect(mockBrowserApi.mock.calls.length).toBeGreaterThan(calls);
    expect(scoringSettings.getState()).toMatchObject({ difficulty: 'HARD' });
    sync.dispose();
  });

  it('pushes later store changes, but only what changed', async () => {
    resetStores();
    mockBrowserApi.mockResolvedValue({ ...account });
    const sync = createPreferenceSync(() => true);
    await sync.adopt('ada@example.com');
    mockBrowserApi.mockClear();

    scoringSettings.setState({ difficulty: 'EASY', octaveMode: 'EXACT' });

    await vi.waitFor(() => {
      expect(mockBrowserApi).toHaveBeenCalledWith('/me/practice-preferences', {
        method: 'PATCH',
        body: { difficulty: 'EASY' },
        schema: expect.anything(),
      });
    });
    sync.dispose();
  });

  it('pushes nothing while signed out', async () => {
    resetStores();
    const sync = createPreferenceSync(() => false);

    scoringSettings.setState({ difficulty: 'HARD', octaveMode: 'ANY' });
    await Promise.resolve();

    expect(mockBrowserApi).not.toHaveBeenCalled();
    sync.dispose();
  });

  it('tries again after a failed adopt', async () => {
    resetStores();
    mockBrowserApi.mockRejectedValueOnce(new Error('offline'));
    const sync = createPreferenceSync(() => true);

    await sync.adopt('ada@example.com');
    expect(scoringSettings.getState()).toMatchObject({
      difficulty: 'NORMAL',
    });

    mockBrowserApi.mockResolvedValue({ ...account });
    await sync.adopt('ada@example.com');
    expect(scoringSettings.getState()).toMatchObject({
      difficulty: 'HARD',
    });
    sync.dispose();
  });

  it('stops pushing once disposed', async () => {
    resetStores();
    const sync = createPreferenceSync(() => true);
    sync.dispose();

    scoringSettings.setState({ difficulty: 'HARD', octaveMode: 'ANY' });
    await Promise.resolve();

    expect(mockBrowserApi).not.toHaveBeenCalled();
  });
});
