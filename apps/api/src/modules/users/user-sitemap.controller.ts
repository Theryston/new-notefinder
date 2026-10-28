import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type UserSitemapPage,
  userSitemapPageSchema,
} from '@vozzify/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ListSitemapQueryDto } from '../../common/sitemap/list-sitemap-query.dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { UserSitemapService } from './user-sitemap.service.js';

@ApiTags('sitemaps')
@Controller('sitemaps')
export class UserSitemapController {
  constructor(private readonly sitemap: UserSitemapService) {}

  // Public: search engines read it through the web's sitemap. Only Users with
  // a Username have a Profile to list.
  @Public()
  @Get('users')
  @ZodSerializerDto(userSitemapPageSchema)
  @ApiOkResponse({
    description: 'A page of Users with a Username, in ID order.',
  })
  @ApiBadRequestResponse({ description: 'The query or the cursor is bad.' })
  listUsers(@Query() query: ListSitemapQueryDto): Promise<UserSitemapPage> {
    return this.sitemap.list(query);
  }
}
