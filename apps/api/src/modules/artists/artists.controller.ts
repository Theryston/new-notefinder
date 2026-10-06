import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type Artist, artistSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ArtistIdParamDto } from './artist-id-param.dto.js';
import { ArtistsService } from './artists.service.js';

@ApiTags('artists')
@Public()
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  // Public catalog header: visitors open it from search, shared links and
  // legacy bookmarks. A legacy ID answers 404 `RESOURCE_MOVED` with the new
  // ID (the web issues a 308); an unknown ID is a real 404 `NOT_FOUND`.
  @Get(':id')
  @ZodSerializerDto(artistSchema)
  @ApiOkResponse({ description: 'The artist header detail.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getArtist(@Param() params: ArtistIdParamDto): Promise<Artist> {
    return this.artistsService.getArtist(params.id);
  }
}
