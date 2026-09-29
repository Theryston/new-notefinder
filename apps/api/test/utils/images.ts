import sharp from 'sharp';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export type ImageOptions = {
  format?: ImageFormat;
  /** A multiple of 3, so the three bands are equally wide. */
  width?: number;
  height?: number;
  /**
   * Gives the picture what a phone photo carries: an EXIF orientation (1-8),
   * a copyright and GPS coordinates.
   */
  metadata?: { orientation: number };
};

const BANDS = ['#ff0000', '#00ff00', '#0000ff'] as const;

const PHONE_PHOTO_EXIF = {
  IFD0: { Copyright: 'Someone' },
  IFD3: {
    GPSLatitudeRef: 'S',
    GPSLatitude: '23/1 32/1 0/1',
    GPSLongitudeRef: 'W',
    GPSLongitude: '46/1 38/1 0/1',
  },
};

const band = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer();

/**
 * A picture in three equal vertical bands, red, green and blue from left to
 * right: enough to tell a center crop from a squashed picture, and an
 * upright picture from a rotated one, with a few bytes per pixel.
 */
export const createImage = async ({
  format = 'png',
  width = 30,
  height = 30,
  metadata,
}: ImageOptions = {}): Promise<Buffer> => {
  const bandWidth = width / 3;
  const bands = await Promise.all(
    BANDS.map((color) => band(bandWidth, height, color)),
  );
  const picture = sharp({
    create: { width, height, channels: 3, background: '#000000' },
  }).composite(
    bands.map((input, index) => ({ input, left: index * bandWidth, top: 0 })),
  );
  const tagged = metadata
    ? picture.withMetadata({
        orientation: metadata.orientation,
        exif: PHONE_PHOTO_EXIF,
      })
    : picture;
  return tagged[format]().toBuffer();
};

export type ImageDescription = {
  format: string | undefined;
  width: number;
  height: number;
  /** EXIF, which is where the GPS position and camera details live. */
  hasExif: boolean;
  /** `[red, green, blue]` at a pixel. */
  pixel: (x: number, y: number) => [number, number, number];
};

/** What is inside an image file, decoded. */
export const describeImage = async (
  image: Uint8Array,
): Promise<ImageDescription> => {
  const { format, width, height, exif } = await sharp(image).metadata();
  const raw = await sharp(image).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    format,
    width,
    height,
    hasExif: exif !== undefined,
    pixel: (x, y) => {
      const at = (y * raw.info.width + x) * raw.info.channels;
      return [
        raw.data[at] ?? -1,
        raw.data[at + 1] ?? -1,
        raw.data[at + 2] ?? -1,
      ];
    },
  };
};

const CHANNEL_TOLERANCE = 40;

/** Whether a decoded pixel is that color, allowing for lossy compression. */
export const isColor = (
  pixel: readonly number[],
  color: 'red' | 'green' | 'blue',
): boolean => {
  const expected = { red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255] }[
    color
  ];
  return pixel.every(
    (channel, index) =>
      Math.abs(channel - (expected[index] ?? 0)) <= CHANNEL_TOLERANCE,
  );
};
