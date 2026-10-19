import 'server-only';

/**
 * How long the preview waits for the Avatar before drawing the initials
 * instead: a slow photo host must not hold up the crawler.
 */
const AVATAR_TIMEOUT_MS = 3000;

/** Larger pictures are not worth the time to decode for a 300px circle. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * The magic numbers of the two formats the image renderer draws (PNG and
 * JPEG). WebP, the other Avatar format, is left to the initials: the renderer
 * does not read it.
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
    const mimeType = mimeTypeOf(bytes);
    if (mimeType === undefined) {
      return undefined;
    }
    return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}
