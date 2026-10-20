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
import { HomePinOverlayService } from './home-pin-overlay.service.js';
import {
  DEFAULT_HOME_LOCALE,
  PUBLIC_HOME_CACHE_CONTROL,
  UNCACHED_HOME_CACHE_CONTROL,
} from './home-rules.js';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(
    private readonly home: HomeService,
    private readonly pinOverlay: HomePinOverlayService,
  ) {}

  // Public, and the same feed for a signed-in visitor for now: nothing personal
  // is in it, so shared caches may store it. A cursor names the feed version it
  // was issued for; the fallback home, served while another request builds the
  // feed, is never stored. The editorial pins live for the viewer are applied
  // per request, so a signed-in visitor gets the "everyone" pins only.
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
    const locale = query.locale ?? DEFAULT_HOME_LOCALE;
    const { page, cacheable } = await this.home.getPage(
      query.cursor,
      locale,
      (rows) =>
        this.pinOverlay.apply(rows, { locale, signedIn: user !== undefined }),
    );
    response.setHeader(
      'Cache-Control',
      cacheable ? PUBLIC_HOME_CACHE_CONTROL : UNCACHED_HOME_CACHE_CONTROL,
    );
    return page;
  }
}
