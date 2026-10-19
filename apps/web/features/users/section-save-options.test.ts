import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { profileKeys } from './query-keys';
import { sectionSaveOptions, withSectionFlag } from './section-save-options';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const labels = {
  visible: 'Visible',
  hidden: 'Hidden',
  saved: 'Saved',
  failed: 'Failed',
};

const stored = {
  summary: true,
  practiceHistory: true,
  favorites: true,
};

const setup = () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(profileKeys.visibility(), stored);
  const notify = { success: vi.fn(), error: vi.fn() };
  const options = sectionSaveOptions('favorites', {
    queryClient,
    labels,
    notify,
  });
  return { queryClient, notify, options };
};

describe('withSectionFlag', () => {
  it('changes only the section named', () => {
    expect(withSectionFlag(stored, 'favorites', false)).toEqual({
      ...stored,
      favorites: false,
    });
  });
});

describe('sectionSaveOptions', () => {
  beforeEach(() => {
    mockBrowserApi.mockReset();
  });

  it('saves the section it names with a PATCH', async () => {
    mockBrowserApi.mockResolvedValueOnce(stored);
    const { options } = setup();

    await options.mutationFn(false);

    expect(mockBrowserApi).toHaveBeenCalledWith(
      '/me/profile-visibility',
      expect.objectContaining({ method: 'PATCH', body: { favorites: false } }),
    );
  });

  it('shows the change at once and keeps what it replaced for a rollback', async () => {
    const { queryClient, options } = setup();

    const context = await options.onMutate(false);

    expect(context).toEqual({ previous: stored });
    expect(queryClient.getQueryData(profileKeys.visibility())).toEqual({
      ...stored,
      favorites: false,
    });
  });

  it('shows nothing optimistically while the flags are not loaded', async () => {
    const queryClient = new QueryClient();
    const options = sectionSaveOptions('favorites', {
      queryClient,
      labels,
      notify: { success: vi.fn(), error: vi.fn() },
    });

    await expect(options.onMutate(false)).resolves.toEqual({
      previous: undefined,
    });
    expect(queryClient.getQueryData(profileKeys.visibility())).toBeUndefined();
  });

  it('puts the stored flags back and says so when the save fails', () => {
    const { queryClient, notify, options } = setup();
    queryClient.setQueryData(profileKeys.visibility(), {
      ...stored,
      favorites: false,
    });

    options.onError(new Error('boom'), false, { previous: stored });

    expect(queryClient.getQueryData(profileKeys.visibility())).toEqual(stored);
    expect(notify.error).toHaveBeenCalledWith('Failed');
  });

  it('still says so when there was nothing to put back', () => {
    const { queryClient, notify, options } = setup();

    options.onError(new Error('boom'), false, undefined);

    expect(queryClient.getQueryData(profileKeys.visibility())).toEqual(stored);
    expect(notify.error).toHaveBeenCalledWith('Failed');
  });

  it('stores the flags the API answered and confirms', () => {
    const { queryClient, notify, options } = setup();
    const answered = { ...stored, favorites: false };

    options.onSuccess(answered);

    expect(queryClient.getQueryData(profileKeys.visibility())).toEqual(
      answered,
    );
    expect(notify.success).toHaveBeenCalledWith('Saved');
  });
});
