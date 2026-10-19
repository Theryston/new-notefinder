import { Injectable, Logger } from '@nestjs/common';
import {
  cacheTags,
  type ProfileSection,
  type ProfileVisibility,
  type UpdateProfileVisibilityBody,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import {
  type ProfileVisibilityRow,
  type ProfileVisibilityValues,
  UsersRepository,
} from './users.repository.js';

/** The stored flag of each section of a Profile. */
const SECTION_FLAG = {
  summary: 'showSummarySection',
  practiceHistory: 'showPracticeHistorySection',
  favorites: 'showFavoritesSection',
} as const satisfies Record<ProfileSection, keyof ProfileVisibilityRow>;

const toVisibility = (row: ProfileVisibilityRow): ProfileVisibility => ({
  summary: row.showSummarySection,
  practiceHistory: row.showPracticeHistorySection,
  favorites: row.showFavoritesSection,
});

/** Only the flags the request names: an absent one keeps its stored value. */
const toValues = (
  changes: UpdateProfileVisibilityBody,
): ProfileVisibilityValues => {
  const values: ProfileVisibilityValues = {};
  for (const section of Object.keys(SECTION_FLAG) as ProfileSection[]) {
    const visible = changes[section];
    if (visible !== undefined) {
      values[SECTION_FLAG[section]] = visible;
    }
  }
  return values;
};

const requireRow = (
  row: ProfileVisibilityRow | undefined,
): ProfileVisibilityRow => {
  if (!row) {
    throw new AppException('UNAUTHORIZED', 'User no longer exists');
  }
  return row;
};

/** Why something failed, looking through wrappers to their `cause`. */
const reasonOf = (error: unknown): string => {
  const cause = error instanceof Error ? error.cause : undefined;
  const failure = cause ?? error;
  return failure instanceof Error ? failure.message : String(failure);
};

/**
 * Which sections of a Profile visitors see. The owner always sees every
 * section; a visitor asking for a hidden one gets `NOT_FOUND`, so its data
 * never leaves the API for them.
 */
@Injectable()
export class ProfileVisibilityService {
  private readonly logger = new Logger(ProfileVisibilityService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  /** The owner's flags. */
  async getVisibility(userId: string): Promise<ProfileVisibility> {
    return toVisibility(
      requireRow(await this.usersRepository.findProfileVisibility(userId)),
    );
  }

  /**
   * Saves the flags given (a partial update) and returns all of them. The
   * Profile banner and the Favorite songs section are cached under their
   * tags, so both are refreshed: a hidden section must not stay visible in a
   * cache.
   */
  async updateVisibility(
    userId: string,
    changes: UpdateProfileVisibilityBody,
  ): Promise<ProfileVisibility> {
    const values = toValues(changes);
    if (Object.keys(values).length === 0) {
      return this.getVisibility(userId);
    }
    const row = requireRow(
      await this.usersRepository.updateProfileVisibility(userId, values),
    );
    if (row.username !== null) {
      await this.revalidateSections(row.username);
    }
    return toVisibility(row);
  }

  /**
   * Lets a section's read through for its owner, and for a visitor when the
   * section is shown. Returns the User's ID, which the owner's reads need.
   * An unknown username and a hidden section are both `NOT_FOUND`.
   */
  async assertSectionVisible(
    username: string,
    section: ProfileSection,
    viewerId: string | undefined,
  ): Promise<string> {
    const row = await this.usersRepository.findProfileVisibilityByUsername(
      username.toLowerCase(),
    );
    if (!row) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
    if (viewerId !== row.id && !row[SECTION_FLAG[section]]) {
      throw new AppException('NOT_FOUND', 'Section not found');
    }
    return row.id;
  }

  /** Best effort: the change is already saved, so a failed enqueue is only logged. */
  private async revalidateSections(username: string): Promise<void> {
    try {
      await this.webRevalidation.revalidate([
        cacheTags.userProfile(username),
        cacheTags.userFavorites(username),
      ]);
    } catch (error) {
      this.logger.warn(
        `Could not enqueue the Profile revalidation: ${reasonOf(error)}`,
      );
    }
  }
}
