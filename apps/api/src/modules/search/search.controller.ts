import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type SearchResult, searchResultSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './search-query.dto.js';

@ApiTags('search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Unauthenticated on purpose: visitors search before they sign up. Abuse
  // is bounded by the global per-IP rate limit; a stricter per-route limit
  // arrives with issue #95.
  @Get()
  @ZodSerializerDto(searchResultSchema)
  @ApiOkResponse({ description: 'Catalog matches, best first.' })
  @ApiBadRequestResponse({ description: 'The query, scope or paging is bad.' })
  search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    return this.searchService.search(query);
  }
}
