import sharp from 'sharp';
import { toStoredCover } from './track-cover-image.js';

const png = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();

describe('toStoredCover', () => {
  it('stores a large image as a webp no bigger than 500 px on either side', async () => {
    const stored = await toStoredCover(new Uint8Array(await png(1200, 800)));

    expect(stored).toBeDefined();
    const metadata = await sharp(stored ?? new Uint8Array()).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(333);
  });

  it('keeps a small image at its size, without enlarging it', async () => {
    const stored = await toStoredCover(new Uint8Array(await png(120, 120)));

    const metadata = await sharp(stored ?? new Uint8Array()).metadata();
    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(120);
  });

  it('refuses bytes that are not an image', async () => {
    await expect(
      toStoredCover(new TextEncoder().encode('<html>not a cover</html>')),
    ).resolves.toBe(undefined);
  });
});
