import { Injectable, Logger } from '@nestjs/common';
import {
  type CurrentUser,
  cacheTags,
  type Locale,
  type UpdateMeBody,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { AVATAR_CONTENT_TYPE, processAvatarImage } from './avatar-image.js';
import {
  type CurrentUserRow,
  type EmailRecipientRow,
  UsersRepository,
} from './users.repository.js';

/**
 * The public fields of a User that other features may show (a Track's
 * Contributors). No email and no role: those never leave the users module.
 */
export type PublicUser = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

/** What a notification email needs about a User (see `findEmailRecipients`). */
export type EmailRecipient = EmailRecipientRow;

const toCurrentUser = (user: CurrentUserRow): CurrentUser => ({
  ...user,
  createdAt: user.createdAt.toISOString(),
});

/** The session outlived its user (deleted in between). */
const requireUser = (user: CurrentUserRow | undefined): CurrentUserRow => {
  if (!user) {
    throw new AppException('UNAUTHORIZED', 'User no longer exists');
  }
  return user;
};

/** Why something failed, looking through wrappers to their `cause`. */
const reasonOf = (error: unknown): string => {
  const cause = error instanceof Error ? error.cause : undefined;
  const failure = cause ?? error;
  return failure instanceof Error ? failure.message : String(failure);
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly webRevalidation: WebRevalidationService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The signed-in user. Read from the database rather than the session so
   * fields changed since sign-in (username, role) are current.
   */
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    return toCurrentUser(
      requireUser(await this.usersRepository.findCurrentUser(userId)),
    );
  }

  /**
   * Sets the username of a user who has none yet (`PUT /v1/me/username`). It
   * never changes once set, so a user that already has one is refused.
   * Stored lowercased, like legacy.
   */
  async setUsername(userId: string, username: string): Promise<CurrentUser> {
    const result = await this.usersRepository.setUsernameIfUnset(
      userId,
      username.toLowerCase(),
    );
    if (result.status === 'set') {
      return toCurrentUser(result.user);
    }
    if (result.status === 'taken') {
      throw new AppException('CONFLICT', 'Username is already taken');
    }
    // Nothing was updated: the user is gone (UNAUTHORIZED) or already had a
    // username.
    requireUser(await this.usersRepository.findCurrentUser(userId));
    throw new AppException('CONFLICT', 'Username is already set');
  }

  /**
   * Records the language the User is browsing in, which their emails follow.
   * Only a request made from the web (a Track request or retry) calls it.
   */
  setLocale(userId: string, locale: Locale): Promise<void> {
    return this.usersRepository.setLocale(userId, locale);
  }

  /**
   * The email and language of the Users given, keyed by ID: what their
   * notification emails need. A User that no longer exists is missing.
   */
  async findEmailRecipients(
    userIds: readonly string[],
  ): Promise<Map<string, EmailRecipient>> {
    const rows = await this.usersRepository.findEmailRecipients([...userIds]);
    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * The public fields of the Users given, keyed by ID. A User that no longer
   * exists is simply missing from the map.
   */
  async findPublicUsers(
    userIds: readonly string[],
  ): Promise<Map<string, PublicUser>> {
    const rows = await this.usersRepository.findPublicUsers([...userIds]);
    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * What the user changes about how they appear to others (`PATCH /v1/me`):
   * the Name and, optionally, a new Avatar. Returns the updated user.
   */
  async updateProfile(
    userId: string,
    changes: UpdateMeBody,
  ): Promise<CurrentUser> {
    const user = requireUser(await this.saveProfile(userId, changes));
    if (user.username !== null) {
      await this.revalidateProfile(user.username);
    }
    return toCurrentUser(user);
  }

  /**
   * Without an Avatar only the Name is written and the current image stays
   * (Google's, a legacy one or none). With one, the file is stored first and
   * both are written in a single update, so a failed upload leaves the
   * profile untouched.
   */
  private async saveProfile(
    userId: string,
    { name, avatar }: UpdateMeBody,
  ): Promise<CurrentUserRow | undefined> {
    if (!avatar) {
      return this.usersRepository.updateName(userId, name);
    }
    const image = await this.storeAvatar(userId, avatar);
    return this.usersRepository.updateNameAndImage(userId, name, image);
  }

  /**
   * Stores the Avatar under a key of its own, replacing the previous one, and
   * returns the URL to save. The timestamp makes each upload a new URL, since
   * browsers and the CDN keep serving the old picture from the same key.
   *
   * @throws {ZodValidationException} when the file is not a usable image.
   * @throws {StorageError} when the file could not be stored.
   */
  private async storeAvatar(userId: string, avatar: File): Promise<string> {
    const body = await processAvatarImage(
      new Uint8Array(await avatar.arrayBuffer()),
    );
    const key = `avatars/${userId}.webp`;
    try {
      await this.storage.putPublicObject({
        key,
        body,
        contentType: AVATAR_CONTENT_TYPE,
      });
    } catch (error) {
      // The error filter only sees the StorageError's own message; what went
      // wrong (access denied, no bucket, timeout) is its cause.
      this.logger.error(`Could not store the Avatar: ${reasonOf(error)}`);
      throw error;
    }
    return `${this.storage.publicUrl(key)}?cacheBust=${Date.now()}`;
  }

  /**
   * Best effort: the change is already saved, so a queue that is down must
   * not turn it into an error.
   */
  private async revalidateProfile(username: string): Promise<void> {
    try {
      await this.webRevalidation.revalidate([cacheTags.userProfile(username)]);
    } catch (error) {
      this.logger.warn(
        `Could not enqueue the Profile revalidation: ${reasonOf(error)}`,
      );
    }
  }
}
