import type { CurrentUser } from '@notefinder/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';

import { updateProfile } from './update-profile';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const saved: CurrentUser = {
  id: 'usr_ada',
  name: 'Ada King',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
  role: 'USER',
  createdAt: '2026-09-28T12:00:00.000Z',
};

function sentForm(): FormData {
  const call = vi.mocked(browserApi).mock.lastCall;
  const body = call?.[1].body;
  if (!(body instanceof FormData)) throw new Error('No multipart body sent');
  return body;
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.mocked(browserApi).mockResolvedValue(saved);
  });

  it('PATCHes /me as multipart with the name and returns the user', async () => {
    const result = await updateProfile({ name: 'Ada King' });

    expect(result).toEqual({ ok: true, user: saved });
    const [path, options] = vi.mocked(browserApi).mock.lastCall ?? [];
    expect(path).toBe('/me');
    expect(options?.method).toBe('PATCH');
    expect([...sentForm()]).toEqual([['name', 'Ada King']]);
  });

  it('sends the Avatar as a file part next to the name', async () => {
    const avatar = new File([new Uint8Array([1, 2, 3])], 'me.png', {
      type: 'image/png',
    });

    await updateProfile({ name: 'Ada King', avatar });

    const form = sentForm();
    expect([...form.keys()]).toEqual(['name', 'avatar']);
    const sent = form.get('avatar');
    expect(sent).toBeInstanceOf(File);
    expect(sent).toMatchObject({ name: 'me.png', type: 'image/png', size: 3 });
  });

  it('sends no avatar part when none was picked', async () => {
    await updateProfile({ name: 'Ada King', avatar: undefined });

    expect(sentForm().has('avatar')).toBe(false);
  });

  it('parses the answer with the current user contract', async () => {
    await updateProfile({ name: 'Ada King' });

    const schema = vi.mocked(browserApi).mock.lastCall?.[1].schema;
    expect(schema?.safeParse(saved).success).toBe(true);
    expect(schema?.safeParse({ ...saved, role: 'OWNER' }).success).toBe(false);
  });

  it('returns the API error code instead of throwing', async () => {
    vi.mocked(browserApi).mockRejectedValue(
      new ApiError({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      }),
    );

    await expect(updateProfile({ name: 'Ada King' })).resolves.toEqual({
      ok: false,
      code: 'RATE_LIMITED',
    });
  });

  it('reports anything else that goes wrong as INTERNAL_ERROR', async () => {
    vi.mocked(browserApi).mockRejectedValue(new TypeError('boom'));

    await expect(updateProfile({ name: 'Ada King' })).resolves.toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });
});
