import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ArtistSitemapPage,
  artistSitemapPageSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ListSitemapQueryDto } from '../../common/sitemap/list-sitemap-query.dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ArtistSitemapService } from './artist-sitemap.service.js';

@ApiTags('sitemaps')
@Controller('sitemaps')
export class ArtistSitemapController {
  constructor(private readonly sitemap: ArtistSitemapService) {}

  // Public: search engines read it through the web's sitemap.
  @Public()
  @Get('artists')
  @ZodSerializerDto(artistSitemapPageSchema)
  @ApiOkResponse({
    description: 'A page of Artists with a completed Track, in ID order.',
  })
  @ApiBadRequestResponse({ description: 'The query or the cursor is bad.' })
  listArtists(@Query() query: ListSitemapQueryDto): Promise<ArtistSitemapPage> {
    return this.sitemap.list(query);
  }
}
