import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  getPracticePreferences,
  updatePracticePreferences,
} from './practice-preferences-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);
const signal = new AbortController().signal;

describe('getPracticePreferences', () => {
  it('reads the account preferences in the browser', async () => {
    mockBrowserApi.mockResolvedValue({ difficulty: 'HARD' });

    await getPracticePreferences(signal);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/practice-preferences', {
      schema: expect.anything(),
      signal,
    });
  });
});

describe('updatePracticePreferences', () => {
  it('patches whichever preferences changed', async () => {
    mockBrowserApi.mockResolvedValue({ difficulty: 'HARD' });

    await updatePracticePreferences({ difficulty: 'HARD' });

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/practice-preferences', {
      method: 'PATCH',
      body: { difficulty: 'HARD' },
      schema: expect.anything(),
    });
  });
});
