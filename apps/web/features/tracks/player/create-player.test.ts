import { describe, expect, it } from 'vitest';

import { createPlayer } from './create-player';
import { FakePlayer } from './fake-player';

describe('createPlayer', () => {
  it('gives the fake player in an e2e build, without touching the host', async () => {
    const player = await createPlayer({
      host: {} as unknown as HTMLElement,
      durationSeconds: 90,
      fake: true,
    });

    expect(player).toBeInstanceOf(FakePlayer);
    await player.load('any');
    expect(player.duration()).toBe(90);
  });
});
