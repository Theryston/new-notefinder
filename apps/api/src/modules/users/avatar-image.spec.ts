import type { AvatarMimeType } from '@notefinder/contracts';
import sharp from 'sharp';
import {
  createImage,
  describeImage,
  type ImageFormat,
  isColor,
} from '../../../test/utils/images.js';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import {
  hasAvatarSignature,
  invalidAvatar,
  processAvatarImage,
} from './avatar-image.js';

// Keyed by the contract's list: accepting a new type there fails to compile
// until this spec covers it too.
const FORMAT_OF: Record<AvatarMimeType, ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};
const FORMATS = Object.values(FORMAT_OF);

const rejection = async (data: Uint8Array) => {
  const error = await processAvatarImage(data).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ZodValidationException);
  return error as ZodValidationException;
};

describe('hasAvatarSignature', () => {
  it.each(FORMATS)('recognizes a real %s file', async (format) => {
    expect(hasAvatarSignature(await createImage({ format }))).toBe(true);
  });

  it.each([
    ['nothing', new Uint8Array()],
    ['text', Buffer.from('<html><body>not an image</body></html>')],
    ['a PDF', Buffer.from('%PDF-1.7\n')],
    ['a GIF', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1')],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    [
      'a RIFF file that is not WEBP (WAV)',
      Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1'),
    ],
    [
      'a PNG signature cut short',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]),
    ],
    ['a JPEG signature cut short', Buffer.from([0xff, 0xd8])],
  ])('rejects %s', (_label, data) => {
    expect(hasAvatarSignature(data)).toBe(false);
  });
});

describe('processAvatarImage', () => {
  it.each(FORMATS)('turns a %s into a 512x512 webp', async (format) => {
    const stored = await describeImage(
      await processAvatarImage(await createImage({ format })),
    );

    expect(stored).toMatchObject({ format: 'webp', width: 512, height: 512 });
  });

  it('crops around the center instead of squashing a wide picture', async () => {
    // Red | green | blue bands of 20 px: the centered 20 px square is green.
    const wide = await createImage({ width: 60, height: 20 });

    const stored = await describeImage(await processAvatarImage(wide));

    expect(stored).toMatchObject({ width: 512, height: 512 });
    for (const x of [20, 256, 490]) {
      expect(isColor(stored.pixel(x, 256), 'green')).toBe(true);
    }
  });

  it('strips the metadata a phone photo carries', async () => {
    const photo = await createImage({
      format: 'jpeg',
      metadata: { orientation: 1 },
    });
    expect((await describeImage(photo)).hasExif).toBe(true);

    const stored = await describeImage(await processAvatarImage(photo));

    expect(stored.hasExif).toBe(false);
  });

  it('keeps a photo upright before it drops its orientation', async () => {
    // Stored sideways and tagged "rotate 90° clockwise": once turned upright
    // the red band is on top and the blue one at the bottom.
    const sideways = await createImage({
      format: 'jpeg',
      metadata: { orientation: 6 },
    });

    const stored = await describeImage(await processAvatarImage(sideways));

    expect(isColor(stored.pixel(256, 20), 'red')).toBe(true);
    expect(isColor(stored.pixel(256, 490), 'blue')).toBe(true);
  });

  describe('a file that is not an accepted image', () => {
    it.each([
      ['text with an image name', Buffer.from('just text, not a picture')],
      ['a GIF', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1')],
      ['an empty file', new Uint8Array()],
    ])('rejects %s as an invalid Avatar', async (_label, data) => {
      const error = await rejection(data);

      expect(error.location).toBe('body');
      expect(error.zodError.issues).toEqual([
        expect.objectContaining({
          code: 'custom',
          path: ['avatar'],
          message: 'Avatar must be a PNG, JPEG or WEBP image',
        }),
      ]);
    });

    it.each(FORMATS)(
      'rejects a truncated %s that only starts like one',
      async (format) => {
        const whole = await createImage({ format, width: 300, height: 300 });

        const error = await rejection(whole.subarray(0, 24));

        expect(error.zodError.issues).toEqual([
          expect.objectContaining({
            path: ['avatar'],
            message: 'Avatar could not be read as an image',
          }),
        ]);
      },
    );

    it('rejects a picture with more pixels than any camera photo', async () => {
      // A few hundred KB of PNG that would need over 150 MB to decode.
      const canvas = await sharp({
        create: {
          width: 7100,
          height: 7100,
          channels: 3,
          background: '#808080',
        },
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
      expect(canvas.byteLength).toBeLessThan(5 * 1024 * 1024);

      const error = await rejection(canvas);

      expect(error.zodError.issues[0]?.message).toBe(
        'Avatar could not be read as an image',
      );
    }, 30_000);
  });
});

describe('invalidAvatar', () => {
  it('is a 400 body validation error on the avatar field', () => {
    const error = invalidAvatar('Nope');

    expect(error.getStatus()).toBe(400);
    expect(error.location).toBe('body');
    expect(error.zodError.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        path: ['avatar'],
        message: 'Nope',
      }),
    ]);
  });
});
