import sharp from 'sharp';

/** The type every stored cover has. */
export const COVER_CONTENT_TYPE = 'image/webp';

/** The longest side, in pixels, of a stored cover. */
const COVER_MAX_SIDE = 500;

// A small file can declare an enormous canvas, and decoding it takes memory in
// proportion to the pixels. Far above any cover a few megabytes can hold.
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * A downloaded image as the cover is stored: a webp no bigger than 500 px on
 * either side. The re-encoding decodes the bytes, so an image is judged by its
 * content, and it drops the metadata the source carried. Undefined when the
 * bytes are not an image the decoder reads.
 */
export async function toStoredCover(
  image: Uint8Array,
): Promise<Uint8Array | undefined> {
  try {
    const encoded = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: COVER_MAX_SIDE,
        height: COVER_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    return new Uint8Array(encoded);
  } catch {
    return undefined;
  }
}
