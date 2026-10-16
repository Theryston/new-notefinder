import { Injectable } from '@nestjs/common';
import type { TrackRecommendations } from '@notefinder/contracts';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRecommendationsRepository } from './track-recommendations.repository.js';

@Injectable()
export class TrackRecommendationsService {
  constructor(
    private readonly recommendations: TrackRecommendationsRepository,
    private readonly processing: TrackProcessingService,
  ) {}

  async getRecommendations(trackId: string): Promise<TrackRecommendations> {
    const result = await this.recommendations.findRecommendations(trackId);
    return result ?? this.processing.throwMovedOrMissing(trackId);
  }
}
