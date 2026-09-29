export type PublicObject = {
  /** Where the object lives inside the bucket, e.g. `avatars/{userId}.webp`. */
  key: string;
  body: Uint8Array;
  contentType: string;
};

/**
 * A storage backend failed. The SDK's own error is the `cause`, so callers
 * can log it without depending on the SDK.
 */
export class StorageError extends Error {
  override readonly name = 'StorageError';
}

/**
 * Public file storage, as much of it as features need: put an object anyone
 * can read, and know the URL it is served from. Features depend on this class
 * (it doubles as the injection token), never on an SDK, so tests replace it
 * with a mock; `S3StorageService` is the one implementation.
 *
 * Writing an existing key overwrites it. When the URL of the new content must
 * differ from the old one (caches), the caller adds its own query string.
 */
export abstract class StorageService {
  /** @throws {StorageError} when the object could not be stored. */
  abstract putPublicObject(object: PublicObject): Promise<void>;

  /** URL the object with this key is served from once stored. */
  abstract publicUrl(key: string): string;
}
