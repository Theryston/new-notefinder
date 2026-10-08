import sharp from 'sharp';

// The one place that decodes and re-encodes images for features (the SDK is
// imported by this integration only, see CLAUDE.md "integrations/").

/**
 * A small file can declare an enormous canvas, and decoding takes memory in
 * proportion to the pixels, not to the file size. Far above any photo a few
 * megabytes can hold.
 */
const MAX_INPUT_PIXELS = 50_000_000;

/** The webp quality sharp uses by default. */
const DEFAULT_WEBP_QUALITY = 80;

export type WebpLayout = {
  width: number;
  height: number;
  /** `cover` crops to the exact size; `inside` keeps the whole image. */
  fit: 'cover' | 'inside';
  position?: 'centre';
  /** Keep an image smaller than the layout at its own size. */
  withoutEnlargement?: boolean;
  quality?: number;
};

/**
 * The image as a webp laid out as asked: upright (the EXIF orientation is
 * applied first) and without its metadata, such as GPS position or camera
 * details. Rejects when the bytes are not an image the decoder reads, or are
 * too large to decode.
 */
export const encodeWebp = (
  input: Uint8Array,
  layout: WebpLayout,
): Promise<Buffer> =>
  sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: layout.width,
      height: layout.height,
      fit: layout.fit,
      position: layout.position,
      withoutEnlargement: layout.withoutEnlargement,
    })
    .webp({ quality: layout.quality ?? DEFAULT_WEBP_QUALITY })
    .toBuffer();
