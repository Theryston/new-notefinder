import type { StreakHeartbeatBody } from '@notefinder/contracts';

/**
 * What `navigator.sendBeacon` needs to post a heartbeat: the browser sends it
 * even as the page closes, with the session cookie, which a `fetch` started
 * then may not survive. The JSON blob carries its content type, so the API
 * reads the body like any other heartbeat.
 */
export function heartbeatBeacon(
  apiUrl: string,
  body: StreakHeartbeatBody,
): { url: string; data: Blob } {
  return {
    url: `${apiUrl.replace(/\/+$/, '')}/v1/me/streak/heartbeat`,
    data: new Blob([JSON.stringify(body)], { type: 'application/json' }),
  };
}
