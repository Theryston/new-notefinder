import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type Artist,
  artistSchema,
  type TrackSummaryPage,
  trackSummaryPageSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ArtistsService } from './artists.service.js';
import { ListTracksQueryDto } from './list-tracks-query.dto.js';

@ApiTags('artists')
@Public()
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get(':artistId')
  @ZodSerializerDto(artistSchema)
  @ApiOkResponse({ description: 'The artist.' })
  @ApiNotFoundResponse({ description: 'No artist has this ID.' })
  getArtist(@Param('artistId') artistId: string): Promise<Artist> {
    return this.artistsService.getArtist(artistId);
  }

  @Get(':artistId/tracks')
  @ZodSerializerDto(trackSummaryPageSchema)
  @ApiOkResponse({
    description:
      "A page of the artist's tracks with notes, most popular first.",
  })
  @ApiBadRequestResponse({ description: 'Invalid `cursor` or `limit`.' })
  @ApiNotFoundResponse({ description: 'No artist has this ID.' })
  listTracks(
    @Param('artistId') artistId: string,
    @Query() query: ListTracksQueryDto,
  ): Promise<TrackSummaryPage> {
    return this.artistsService.listTracks(artistId, query);
  }
}
