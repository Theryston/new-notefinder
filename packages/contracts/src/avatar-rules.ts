/**
 * Rules for an uploaded Avatar, shared by the API and the clients' pre-check.
 * Kept free of Zod so clients can import them
 * (`@notefinder/contracts/avatar-rules`) without shipping the schema library
 * on first load.
 */

/** Largest Avatar file accepted (legacy: 5 MB). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Image types accepted for an Avatar (legacy: PNG, JPEG and WEBP). Clients use
 * them to filter the picker and to pre-check a file; the API decides from the
 * file's content, never from the MIME type the client declares.
 */
export const AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
