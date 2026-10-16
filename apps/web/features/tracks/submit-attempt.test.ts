import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';
import { trackKeys } from './query-keys';
import { submitAttemptMutation } from './submit-attempt';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { toast } from 'sonner';

const mockBrowserApi = vi.mocked(browserApi);
const mockToast = vi.mocked(toast.error);

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

const translate = (message: { key: string }) => message.key;

describe('submitAttemptMutation', () => {
  it('posts the run to the Track attempts', async () => {
    const queryClient = new QueryClient();
    mockBrowserApi.mockResolvedValue({ id: 'attempt-1' });
    const mutation = submitAttemptMutation(queryClient, 't1', translate);

    await mutation.mutationFn({ ...body });

    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/t1/attempts', {
      method: 'POST',
      body: { ...body },
      schema: expect.anything(),
    });
  });

  it('reads the Track state again once the run lands', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(trackKeys.userState('t1'), {
      isFavorite: false,
    });
    const mutation = submitAttemptMutation(queryClient, 't1', translate);

    mutation.onSuccess();

    expect(
      queryClient.getQueryState(trackKeys.userState('t1'))?.isInvalidated,
    ).toBe(true);
  });

  it('toasts the API error code when the run is refused', () => {
    const queryClient = new QueryClient();
    const mutation = submitAttemptMutation(queryClient, 't1', translate);

    mutation.onError(
      new ApiError({
        statusCode: 422,
        code: 'ATTEMPT_REJECTED',
        message: 'The run covered too little',
      }),
    );

    expect(mockToast).toHaveBeenCalledWith('errors.ATTEMPT_REJECTED');
  });
});
