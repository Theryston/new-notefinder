import { describe, expect, it } from 'vitest';

import { heartbeatBeacon } from './heartbeat-beacon';

describe('heartbeatBeacon', () => {
  it('posts to the versioned heartbeat route, whatever the trailing slashes', () => {
    const body = { elapsedSeconds: 3, timeZone: 'America/Sao_Paulo' };

    expect(heartbeatBeacon('http://api.test', body).url).toBe(
      'http://api.test/v1/me/streak/heartbeat',
    );
    expect(heartbeatBeacon('http://api.test//', body).url).toBe(
      'http://api.test/v1/me/streak/heartbeat',
    );
  });

  it('sends the body as JSON', async () => {
    const body = { elapsedSeconds: 3, timeZone: 'UTC' };

    const { data } = heartbeatBeacon('http://api.test', body);

    expect(data.type).toBe('application/json');
    expect(JSON.parse(await data.text())).toEqual(body);
  });
});
