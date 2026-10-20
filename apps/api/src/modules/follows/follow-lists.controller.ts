import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FollowListPage } from '@notefinder/contracts';
import { followListPageSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { FollowListQueryDto } from './follow-list-query.dto.js';
import { FollowListsService } from './follow-lists.service.js';
import { ProfileFollowParamDto } from './profile-follow-param.dto.js';

/**
 * The followers, following and friends lists of a Profile. Anonymous, like the
 * Profile banner: a visitor reads who follows whom on a public Profile.
 */
@ApiTags('users')
@Public()
@Controller('users')
export class FollowListsController {
  constructor(private readonly followLists: FollowListsService) {}

  @Get(':username/followers')
  @ZodSerializerDto(followListPageSchema)
  @ApiOkResponse({
    description:
      'The Users who follow the User, most recent follow first, paginated.',
  })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getFollowers(
    @Param() params: ProfileFollowParamDto,
    @Query() query: FollowListQueryDto,
  ): Promise<FollowListPage> {
    return this.followLists.listPage('followers', params.username, query);
  }

  @Get(':username/following')
  @ZodSerializerDto(followListPageSchema)
  @ApiOkResponse({
    description:
      'The Users the User follows, most recent follow first, paginated.',
  })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getFollowing(
    @Param() params: ProfileFollowParamDto,
    @Query() query: FollowListQueryDto,
  ): Promise<FollowListPage> {
    return this.followLists.listPage('following', params.username, query);
  }

  @Get(':username/friends')
  @ZodSerializerDto(followListPageSchema)
  @ApiOkResponse({
    description:
      'The Users the User follows who follow them back (mutual follows), most ' +
      'recent follow first, paginated.',
  })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getFriends(
    @Param() params: ProfileFollowParamDto,
    @Query() query: FollowListQueryDto,
  ): Promise<FollowListPage> {
    return this.followLists.listPage('friends', params.username, query);
  }
}
