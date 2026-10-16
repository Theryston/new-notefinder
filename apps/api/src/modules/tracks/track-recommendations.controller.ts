import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type TrackRecommendations,
  trackRecommendationsSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { TrackIdParamDto } from './track-id-param.dto.js';
import { TrackRecommendationsService } from './track-recommendations.service.js';

@ApiTags('tracks')
@Controller('tracks')
export class TrackRecommendationsController {
  constructor(private readonly recommendations: TrackRecommendationsService) {}

  @Public()
  @Get(':trackId/recommendations')
  @ZodSerializerDto(trackRecommendationsSchema)
  @ApiOkResponse({
    description:
      'Up to seven completed Tracks: credited artists, closest vocal range, then trending.',
  })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (NOT_FOUND), or a legacy ID with its new ID (RESOURCE_MOVED).',
  })
  getRecommendations(
    @Param() params: TrackIdParamDto,
  ): Promise<TrackRecommendations> {
    return this.recommendations.getRecommendations(params.trackId);
  }
}
