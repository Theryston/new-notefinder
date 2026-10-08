import sharp from 'sharp';
import { encodeWebp } from './image-encoder.js';

const png = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 90, b: 0 } },
  })
    .png()
    .toBuffer();

describe('encodeWebp', () => {
  it('crops to the exact size when the layout asks for cover', async () => {
    const encoded = await encodeWebp(new Uint8Array(await png(800, 400)), {
      width: 200,
      height: 200,
      fit: 'cover',
      position: 'centre',
    });

    const metadata = await sharp(encoded).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 200, height: 200 });
  });

  it('keeps the whole image inside the layout, without enlarging it', async () => {
    const encoded = await encodeWebp(new Uint8Array(await png(800, 400)), {
      width: 500,
      height: 500,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const small = await encodeWebp(new Uint8Array(await png(120, 60)), {
      width: 500,
      height: 500,
      fit: 'inside',
      withoutEnlargement: true,
    });

    await expect(sharp(encoded).metadata()).resolves.toMatchObject({
      width: 500,
      height: 250,
    });
    await expect(sharp(small).metadata()).resolves.toMatchObject({
      width: 120,
      height: 60,
    });
  });

  it('rejects bytes that are not an image', async () => {
    await expect(
      encodeWebp(new TextEncoder().encode('plain text'), {
        width: 10,
        height: 10,
        fit: 'cover',
      }),
    ).rejects.toThrow();
  });
});
