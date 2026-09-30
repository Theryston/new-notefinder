import { API_KEY, useTestServer } from './utils/create-test-server.js';
import { connect } from './utils/ws-client.js';

const INTERVAL_MS = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('heartbeat (e2e)', () => {
  const server = useTestServer({ HEARTBEAT_INTERVAL_MS: String(INTERVAL_MS) });

  it('drops a connection that stops answering pings', async () => {
    const dead = await connect(server().url, API_KEY, { autoPong: false });

    // Terminated by the server (abnormal closure) within two intervals.
    await expect(dead.closed).resolves.toEqual({ code: 1006 });
  });

  it('keeps a connection that answers pings, however long it idles', async () => {
    const healthy = await connect(server().url, API_KEY);

    await sleep(INTERVAL_MS * 6);

    expect(healthy.isOpen).toBe(true);
    await expect(healthy.request('status', {})).resolves.toMatchObject({
      ok: true,
    });
    await healthy.close();
  });

  it('only drops the dead connection, not the healthy one next to it', async () => {
    const healthy = await connect(server().url, API_KEY);
    const dead = await connect(server().url, API_KEY, { autoPong: false });

    await dead.closed;

    expect(healthy.isOpen).toBe(true);
    await healthy.close();
  });
});
