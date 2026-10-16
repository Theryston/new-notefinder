import { Injectable } from '@nestjs/common';
import type { TrackAudio } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import type { AuthUser } from '../auth/auth.js';
import { TrackDirectAudioRepository } from './track-direct-audio.repository.js';

/** The single policy seam for future per-Track licensing. */
function mayListenDirectly(user: Pick<AuthUser, 'role'> | undefined): boolean {
  return user?.role === 'ADMIN';
}

@Injectable()
export class TrackDirectAudioService {
  constructor(private readonly audio: TrackDirectAudioRepository) {}

  async getAudio(
    trackId: string,
    user: Pick<AuthUser, 'role'> | undefined,
  ): Promise<TrackAudio> {
    if (!mayListenDirectly(user)) {
      throw new AppException('FORBIDDEN', 'Direct audio is restricted');
    }
    const row = await this.audio.findLatestCompleted(trackId);
    if (!row?.musicMp3Url || !row.vocalsMp3Url) {
      throw new AppException('NOT_FOUND', 'Track audio is not available');
    }
    return { musicMp3Url: row.musicMp3Url, vocalsMp3Url: row.vocalsMp3Url };
  }
}
