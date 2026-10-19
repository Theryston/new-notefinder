import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UserFavoritesPage } from '@notefinder/contracts';
import { userFavoritesPageSchema } from '@notefinder/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { ProfileVisibilityService } from '../users/profile-visibility.service.js';
import { PublicFavoritesParamDto } from './public-favorites-param.dto.js';
import { UserFavoritesService } from './user-favorites.service.js';
import { UserFavoritesQueryDto } from './user-favorites-query.dto.js';

// Anonymous, like the Profile banner: a visitor reads a User's favorites on
// their public Profile.
@ApiTags('users')
@Public()
@Controller('users')
export class UserFavoritesController {
  constructor(
    private readonly userFavorites: UserFavoritesService,
    private readonly profileVisibility: ProfileVisibilityService,
  ) {}

  @Get(':username/favorites')
  @ZodSerializerDto(userFavoritesPageSchema)
  @ApiOkResponse({
    description:
      'The favorite Tracks of the User with a completed Processing, newest ' +
      'favorited first, paginated.',
  })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  @ApiNotFoundResponse({
    description:
      'No User has this username, or the owner hid this section (`NOT_FOUND`).',
  })
  async getFavorites(
    @Param() params: PublicFavoritesParamDto,
    @Query() query: UserFavoritesQueryDto,
    @CurrentUser() viewer: AuthUser | undefined,
  ): Promise<UserFavoritesPage> {
    await this.profileVisibility.readSection(
      params.username,
      'favorites',
      viewer?.id,
    );
    return this.userFavorites.listPage(params.username, query);
  }
}
