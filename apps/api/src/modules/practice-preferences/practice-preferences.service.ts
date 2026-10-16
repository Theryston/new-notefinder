import { Injectable } from '@nestjs/common';
import type {
  PracticePreferences,
  UpdatePracticePreferencesBody,
} from '@notefinder/contracts';
import type { PracticePreferencesRow } from './practice-preferences.repository.js';
import { PracticePreferencesRepository } from './practice-preferences.repository.js';

const toPreferences = (row: PracticePreferencesRow): PracticePreferences => ({
  difficulty: row.difficulty,
  octaveMode: row.octaveMode,
  guideMelody: row.guideMelody,
  countIn: row.countIn,
});

/**
 * What follows the signed-in User across devices. Nothing is stored until
 * the first change: a User who never touched the settings reads the same
 * defaults the page uses for visitors.
 */
@Injectable()
export class PracticePreferencesService {
  constructor(private readonly preferences: PracticePreferencesRepository) {}

  async get(userId: string): Promise<PracticePreferences> {
    const row = await this.preferences.find(userId);
    if (!row) {
      return {
        difficulty: 'NORMAL',
        octaveMode: 'ANY',
        guideMelody: false,
        countIn: true,
      };
    }
    return toPreferences(row);
  }

  async update(
    userId: string,
    body: UpdatePracticePreferencesBody,
  ): Promise<PracticePreferences> {
    // An empty patch changes nothing: read back what is stored (or the
    // defaults) instead of writing an empty update.
    if (Object.keys(body).length === 0) {
      return this.get(userId);
    }
    return toPreferences(await this.preferences.upsert(userId, body));
  }
}
