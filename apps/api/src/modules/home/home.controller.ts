import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type HomeFeed, homeFeedSchema } from '@notefinder/contracts';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { HomeService } from './home.service.js';
import { HomeFeedQueryDto } from './home-feed-query.dto.js';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  // Public: a signed-in visitor gets the same route, with the pins for Users.
  // Its response is private, since it differs from the anonymous one. A cursor
  // names the feed version it was issued for; the fallback home, served while
  // another request builds the feed, is never stored.
  @Public()
  @Get()
  @ZodSerializerDto(homeFeedSchema)
  @ApiOkResponse({
    description: 'One page of the home feed (at most six rows).',
  })
  @ApiBadRequestResponse({ description: 'The cursor is malformed.' })
  @ApiNotFoundResponse({
    description:
      'The cursor names a feed version that is no longer served (`NOT_FOUND`, `details.reason` = `FEED_VERSION_EXPIRED`): start again from the first page.',
  })
  async getHome(
    @Query() query: HomeFeedQueryDto,
    @CurrentUser() user: AuthUser | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HomeFeed> {
    const { page, cacheControl } = await this.home.getPage(
      query.cursor,
      query.locale,
      user !== undefined,
    );
    response.setHeader('Cache-Control', cacheControl);
    return page;
  }
}
