import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type Album,
  albumSchema,
  type TrackSummaryPage,
  trackSummaryPageSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { AlbumsService } from './albums.service.js';
import { ListTracksQueryDto } from './list-tracks-query.dto.js';

@ApiTags('albums')
@Public()
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get(':albumId')
  @ZodSerializerDto(albumSchema)
  @ApiOkResponse({ description: 'The album.' })
  @ApiNotFoundResponse({ description: 'No album has this ID.' })
  getAlbum(@Param('albumId') albumId: string): Promise<Album> {
    return this.albumsService.getAlbum(albumId);
  }

  @Get(':albumId/tracks')
  @ZodSerializerDto(trackSummaryPageSchema)
  @ApiOkResponse({
    description: "A page of the album's tracks with notes, most popular first.",
  })
  @ApiBadRequestResponse({ description: 'Invalid `cursor` or `limit`.' })
  @ApiNotFoundResponse({ description: 'No album has this ID.' })
  listTracks(
    @Param('albumId') albumId: string,
    @Query() query: ListTracksQueryDto,
  ): Promise<TrackSummaryPage> {
    return this.albumsService.listTracks(albumId, query);
  }
}
