import type {
  StreakHeartbeatBody,
  StreakHeartbeatResult,
} from '@notefinder/contracts';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { streakKeys } from '../query-keys';
import { sendHeartbeat } from '../streak-queries';
import { useStreakHeartbeat } from './use-streak-heartbeat';

const lifecycle = vi.hoisted(() => ({
  effects: [] as (() => undefined | (() => void))[],
  client: null as QueryClient | null,
}));

vi.mock('react', () => ({
  useRef: <T>(current: T) => ({ current }),
  useEffect: (effect: () => undefined | (() => void)) =>
    lifecycle.effects.push(effect),
}));
vi.mock('@tanstack/react-query', async (original) => {
  const actual = await original<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => lifecycle.client,
    useMutation: (options: {
      mutationFn: typeof sendHeartbeat;
      onSuccess: (
        result: StreakHeartbeatResult,
        body: StreakHeartbeatBody,
      ) => void;
    }) => ({
      mutateAsync: async (body: StreakHeartbeatBody) => {
        const result = await options.mutationFn(body);
        options.onSuccess(result, body);
        return result;
      },
    }),
  };
});
vi.mock('../streak-queries', () => ({
  browserTimeZone: () => 'America/Sao_Paulo',
  sendHeartbeat: vi.fn(),
}));
vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

const status = {
  day: '2026-10-15',
  listenedSeconds: 300,
  targetSeconds: 300,
  completedToday: true,
  currentStreakDays: 2,
};
let cleanup: (() => void)[];
let pageDocument: EventTarget & { visibilityState: string };
let pageWindow: EventTarget;
let beacon: ReturnType<typeof vi.fn>;

function HeartbeatHarness({
  playing,
  account,
}: {
  playing: boolean;
  account?: string;
}) {
  const completed = vi.fn();
  useStreakHeartbeat(playing, completed, account);
  cleanup = lifecycle.effects.flatMap((effect) => {
    const dispose = effect();
    return typeof dispose === 'function' ? [dispose] : [];
  });
  return completed;
}

beforeEach(() => {
  vi.useFakeTimers();
  lifecycle.effects = [];
  lifecycle.client = new QueryClient();
  cleanup = [];
  pageDocument = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
  });
  pageWindow = new EventTarget();
  beacon = vi.fn().mockReturnValue(true);
  vi.stubGlobal('document', pageDocument);
  vi.stubGlobal('window', pageWindow);
  vi.stubGlobal('navigator', { sendBeacon: beacon });
  vi.mocked(sendHeartbeat).mockResolvedValue({
    status,
    justCompleted: true,
    creditedSeconds: 5,
  });
});
afterEach(() => {
  for (const dispose of cleanup) dispose();
  lifecycle.client?.clear();
  vi.useRealTimers();
});

describe('practice heartbeat lifecycle', () => {
  it('updates the zone-specific cached status and celebrates completion', async () => {
    const completed = HeartbeatHarness({ playing: true });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sendHeartbeat).toHaveBeenCalledWith({
      elapsedSeconds: 5,
      timeZone: 'America/Sao_Paulo',
    });
    expect(
      lifecycle.client?.getQueryData(streakKeys.status('America/Sao_Paulo')),
    ).toEqual(status);
    expect(completed).toHaveBeenCalledExactlyOnceWith(status);
  });

  it('keeps an old account response out of the next account and suppresses its celebration', async () => {
    let finish: ((result: StreakHeartbeatResult) => void) | undefined;
    vi.mocked(sendHeartbeat).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const completedA = HeartbeatHarness({
      playing: true,
      account: 'a@example.com',
    });
    await vi.advanceTimersByTimeAsync(5_000);
    for (const dispose of cleanup) dispose();
    lifecycle.effects = [];
    const completedB = HeartbeatHarness({
      playing: false,
      account: 'b@example.com',
    });
    finish?.({ status, justCompleted: true, creditedSeconds: 5 });
    await vi.advanceTimersByTimeAsync(0);
    expect(
      lifecycle.client?.getQueryData(
        streakKeys.status('America/Sao_Paulo', 'a@example.com'),
      ),
    ).toEqual(status);
    expect(
      lifecycle.client?.getQueryData(
        streakKeys.status('America/Sao_Paulo', 'b@example.com'),
      ),
    ).toBeUndefined();
    expect(completedA).not.toHaveBeenCalled();
    expect(completedB).not.toHaveBeenCalled();
  });

  it('does not celebrate an ordinary heartbeat', async () => {
    vi.mocked(sendHeartbeat).mockResolvedValue({
      status,
      justCompleted: false,
      creditedSeconds: 5,
    });
    const completed = HeartbeatHarness({ playing: true });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(completed).not.toHaveBeenCalled();
  });

  it('keeps a paused page idle', async () => {
    HeartbeatHarness({ playing: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sendHeartbeat).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('flushes only when hidden and sends the session heartbeat JSON', async () => {
    HeartbeatHarness({ playing: true });
    await vi.advanceTimersByTimeAsync(3_000);
    pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).not.toHaveBeenCalled();
    pageDocument.visibilityState = 'hidden';
    pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledExactlyOnceWith(
      'https://api.test/v1/me/streak/heartbeat',
      expect.any(Blob),
    );
    const data: unknown = beacon.mock.calls[0]?.[1];
    expect(data).toBeInstanceOf(Blob);
    if (!(data instanceof Blob)) throw new Error('Missing heartbeat body');
    expect(JSON.parse(await data.text())).toEqual({
      elapsedSeconds: 3,
      timeZone: 'America/Sao_Paulo',
    });
  });

  it('flushes on pagehide and removes timers and listeners on unmount', async () => {
    HeartbeatHarness({ playing: true });
    await vi.advanceTimersByTimeAsync(2_000);
    pageWindow.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    for (const dispose of cleanup) dispose();
    cleanup = [];
    expect(beacon).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    pageWindow.dispatchEvent(new Event('pagehide'));
    pageDocument.visibilityState = 'hidden';
    pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat).not.toHaveBeenCalled();
  });
});
