import { describe, expect, it, vi } from 'vitest';

import { loadProfileOgAvatar } from './profile-og-avatar';

vi.mock('server-only', () => ({}));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00];

const picture = (bytes: number[], init?: ResponseInit) =>
  new Response(new Uint8Array(bytes), init);

describe('loadProfileOgAvatar', () => {
  it('answers undefined without a picture, and does not fetch', async () => {
    const fetchFn = vi.fn<typeof fetch>();

    await expect(loadProfileOgAvatar(null, fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('embeds a PNG as a data URL, whatever Content-Type the host sent', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        picture(PNG, { headers: { 'content-type': 'text/plain' } }),
      );

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`,
    );
  });

  it('embeds a JPEG as a data URL', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(picture(JPEG));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toMatch(/^data:image\/jpeg;base64,/);
  });

  it('leaves formats the image cannot draw (WebP) to the initials', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(picture(WEBP));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
  });

  it('leaves a failed response to the initials', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(picture(PNG, { status: 404 }));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
  });

  it('leaves a picture too large to draw quickly to the initials', async () => {
    const tooLarge = [...PNG, ...new Array<number>(2 * 1024 * 1024).fill(0)];
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(picture(tooLarge));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
  });

  it('stops reading a picture that passes the cap when it sends no Content-Length', async () => {
    const chunkSize = 64 * 1024;
    const cap = 2 * 1024 * 1024;
    let bytesPulled = 0;
    // A picture that never ends: without the cap this read would not finish.
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = new Uint8Array(chunkSize);
        if (bytesPulled === 0) chunk.set(PNG);
        bytesPulled += chunkSize;
        controller.enqueue(chunk);
      },
    });
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(endless));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
    // The reader gives up once past the cap; a few chunks may already be queued.
    expect(bytesPulled).toBeLessThanOrEqual(cap + 4 * chunkSize);
  });

  it('leaves a picture whose Content-Length lies about its size to the initials', async () => {
    const body = new Uint8Array([
      ...PNG,
      ...new Array<number>(3 * 1024 * 1024).fill(0),
    ]);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(body, { headers: { 'content-length': '100' } }),
      );

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
  });

  it('never throws: a network failure leaves the initials', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      loadProfileOgAvatar('https://images.example.com/a', fetchFn),
    ).resolves.toBeUndefined();
  });
});
