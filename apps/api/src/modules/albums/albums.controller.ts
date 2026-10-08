import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type Album, albumSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { AlbumIdParamDto } from './album-id-param.dto.js';
import { AlbumsService } from './albums.service.js';

@ApiTags('albums')
@Public()
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  // Public album header: visitors open it from shared links and legacy
  // bookmarks. A legacy ID answers 404 `RESOURCE_MOVED` with the new ID (the
  // web issues a 308); an unknown ID is a real 404 `NOT_FOUND`.
  @Get(':id')
  @ZodSerializerDto(albumSchema)
  @ApiOkResponse({ description: 'The album header detail.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getAlbum(@Param() params: AlbumIdParamDto): Promise<Album> {
    return this.albumsService.getAlbum(params.id);
  }
}
