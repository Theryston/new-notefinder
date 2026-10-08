import { AVATAR_MIME_TYPES, type AvatarMimeType } from '@notefinder/contracts';
import { z } from 'zod';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import { encodeWebp } from '../../integrations/image/image-encoder.js';

/** Side, in pixels, of the square every stored Avatar is cropped to. */
const AVATAR_SIZE = 512;

/** What `processAvatarImage` produces, and so the stored object's type. */
export const AVATAR_CONTENT_TYPE = 'image/webp';

type Signature = readonly { offset: number; bytes: readonly number[] }[];

/**
 * The first bytes of each accepted type. A `Record` keyed by the contract's
 * list, so accepting a new type there does not compile until it is handled
 * here.
 */
const SIGNATURES: Record<AvatarMimeType, Signature> = {
  'image/png': [
    { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  ],
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  // A RIFF container whose form type is "WEBP" (WAV and AVI are RIFF too).
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
};

const matches = (data: Uint8Array, signature: Signature): boolean =>
  signature.every(({ offset, bytes }) =>
    bytes.every((byte, index) => data[offset + index] === byte),
  );

/**
 * Whether the content starts like a PNG, JPEG or WEBP image. What the client
 * called the file (extension, `Content-Type`) says nothing about it.
 */
export const hasAvatarSignature = (data: Uint8Array): boolean =>
  AVATAR_MIME_TYPES.some((type) => matches(data, SIGNATURES[type]));

/**
 * The 400 `VALIDATION_FAILED` for an Avatar the API refuses, shaped like the
 * ones the body schema raises (`details.issues` points at `avatar`).
 */
export const invalidAvatar = (message: string): ZodValidationException =>
  new ZodValidationException(
    new z.ZodError([{ code: 'custom', path: ['avatar'], message }]),
    'body',
  );

/**
 * The Avatar as it is stored: a 512×512 webp, centered crop, upright (the
 * EXIF orientation is applied before the metadata goes) and free of metadata
 * such as GPS position and camera details.
 *
 * @throws {ZodValidationException} when the content is not a PNG, JPEG or
 * WEBP image, or cannot be decoded.
 */
export const processAvatarImage = async (data: Uint8Array): Promise<Buffer> => {
  if (!hasAvatarSignature(data)) {
    throw invalidAvatar('Avatar must be a PNG, JPEG or WEBP image');
  }
  try {
    return await encodeWebp(data, {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      fit: 'cover',
      position: 'centre',
    });
  } catch {
    // libvips reports a damaged or oversized image as a plain Error.
    throw invalidAvatar('Avatar could not be read as an image');
  }
};
