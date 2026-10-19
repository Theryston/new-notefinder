import 'server-only';

import sharp from 'sharp';

/**
 * How long the preview waits for the Avatar before drawing the initials
 * instead: a slow photo host must not hold up the crawler.
 */
const AVATAR_TIMEOUT_MS = 3000;

/** Larger pictures are not worth the time to decode for a 300px circle. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * The magic numbers of the formats the Avatar can be in. The image renderer
 * draws only PNG and JPEG, so an uploaded WebP (the stored format, see
 * `apps/api` avatar-image.ts) is decoded and re-encoded as PNG first.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_FORM_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const WEBP_FORM_OFFSET = 8;

/**
 * Same cap as the API's decoder: a small file can declare a huge canvas, and
 * decoding takes memory in proportion to the pixels.
 */
const MAX_AVATAR_PIXELS = 50_000_000;

type Format = 'image/png' | 'image/jpeg' | 'image/webp';

function formatOf(bytes: Uint8Array): Format | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (
    startsWith(bytes, WEBP_RIFF_SIGNATURE) &&
    startsWith(bytes, WEBP_FORM_SIGNATURE, WEBP_FORM_OFFSET)
  ) {
    return 'image/webp';
  }
  return undefined;
}

function startsWith(
  bytes: Uint8Array,
  signature: number[],
  offset = 0,
): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The picture in a format the renderer draws, as a PNG when it is WebP.
 * `undefined` when it is neither (the initials are drawn instead).
 */
async function drawable(
  bytes: Uint8Array,
): Promise<{ mimeType: 'image/png' | 'image/jpeg'; data: Buffer } | undefined> {
  const format = formatOf(bytes);
  if (format === undefined) return undefined;
  if (format === 'image/webp') {
    const data = await sharp(bytes, { limitInputPixels: MAX_AVATAR_PIXELS })
      .png()
      .toBuffer();
    return { mimeType: 'image/png', data };
  }
  return { mimeType: format, data: Buffer.from(bytes) };
}

/**
 * The body, read chunk by chunk and abandoned as soon as it passes the cap, so
 * a picture that lies about its size (or has no Content-Length at all) cannot
 * make the preview download more than `MAX_AVATAR_BYTES`. `undefined` when it
 * is too large.
 */
async function readWithinCap(
  response: Response,
): Promise<Uint8Array | undefined> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > MAX_AVATAR_BYTES) {
    await response.body?.cancel();
    return undefined;
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return new Uint8Array(0);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    total += chunk.value.byteLength;
    if (total > MAX_AVATAR_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}

/**
 * The Avatar as a `data:` URL, sniffed from its bytes (the remote
 * Content-Type is not trusted), or `undefined` when there is none, it is too
 * slow, too large or in a format the image cannot draw. Never throws: the
 * card falls back to the initials.
 */
export async function loadProfileOgAvatar(
  url: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  if (url === null) {
    return undefined;
  }
  try {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
    });
    if (!response.ok) {
      return undefined;
    }
    const bytes = await readWithinCap(response);
    if (bytes === undefined) {
      return undefined;
    }
    const picture = await drawable(bytes);
    if (picture === undefined) {
      return undefined;
    }
    return `data:${picture.mimeType};base64,${picture.data.toString('base64')}`;
  } catch {
    return undefined;
  }
}
