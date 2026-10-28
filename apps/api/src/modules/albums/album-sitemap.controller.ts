import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type AlbumSitemapPage,
  albumSitemapPageSchema,
} from '@vozzify/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ListSitemapQueryDto } from '../../common/sitemap/list-sitemap-query.dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { AlbumSitemapService } from './album-sitemap.service.js';

@ApiTags('sitemaps')
@Controller('sitemaps')
export class AlbumSitemapController {
  constructor(private readonly sitemap: AlbumSitemapService) {}

  // Public: search engines read it through the web's sitemap.
  @Public()
  @Get('albums')
  @ZodSerializerDto(albumSitemapPageSchema)
  @ApiOkResponse({
    description: 'A page of Albums with a completed Track, in ID order.',
  })
  @ApiBadRequestResponse({ description: 'The query or the cursor is bad.' })
  listAlbums(@Query() query: ListSitemapQueryDto): Promise<AlbumSitemapPage> {
    return this.sitemap.list(query);
  }
}
