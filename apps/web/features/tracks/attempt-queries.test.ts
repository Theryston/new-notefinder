import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { submitPracticeAttempt } from './attempt-queries';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const body = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
  transposeSemitones: 0,
  speed: 1,
  accuracy: 0.8,
  coverage: 0.95,
  forwardSkip: false,
  bleedSuspected: false,
  startedAt: '2026-10-16T10:00:00.000Z',
  endedAt: '2026-10-16T10:04:00.000Z',
} as const;

describe('submitPracticeAttempt', () => {
  it('posts the run to the Track attempts', async () => {
    mockBrowserApi.mockResolvedValue({ id: 'attempt-1' });

    await submitPracticeAttempt('a/b', { ...body });

    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/a%2Fb/attempts', {
      method: 'POST',
      body: { ...body },
      schema: expect.anything(),
    });
  });
});
