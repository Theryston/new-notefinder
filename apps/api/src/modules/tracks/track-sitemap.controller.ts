import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type TrackSitemapPage,
  trackSitemapPageSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ListTrackSitemapQueryDto } from './list-track-sitemap-query.dto.js';
import { TrackSitemapService } from './track-sitemap.service.js';

@ApiTags('sitemaps')
@Controller('sitemaps')
export class TrackSitemapController {
  constructor(private readonly sitemap: TrackSitemapService) {}

  // Public: search engines read it through the web's sitemap.
  @Public()
  @Get('tracks')
  @ZodSerializerDto(trackSitemapPageSchema)
  @ApiOkResponse({
    description:
      'A page of completed Tracks, the highest trending score first.',
  })
  @ApiBadRequestResponse({ description: 'The query or the cursor is bad.' })
  listTracks(
    @Query() query: ListTrackSitemapQueryDto,
  ): Promise<TrackSitemapPage> {
    return this.sitemap.list(query);
  }
}
