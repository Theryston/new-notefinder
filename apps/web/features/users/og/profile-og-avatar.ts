import 'server-only';

/**
 * How long the preview waits for the Avatar before drawing the initials
 * instead: a slow photo host must not hold up the crawler.
 */
const AVATAR_TIMEOUT_MS = 3000;

/** Larger pictures are not worth the time to decode for a 300px circle. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * The image formats the preview image can draw. WebP avatars are left to the
 * initials: the image renderer does not read them.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function mimeTypeOf(bytes: Uint8Array): 'image/png' | 'image/jpeg' | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  return undefined;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
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
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = mimeTypeOf(bytes);
    if (mimeType === undefined || bytes.byteLength > MAX_AVATAR_BYTES) {
      return undefined;
    }
    return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}
