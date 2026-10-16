import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type TrackPracticeState,
  trackPracticeStateSchema,
} from '@notefinder/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { FavoriteTrackParamDto } from './favorite-track-param.dto.js';
import { FavoritesService } from './favorites.service.js';
import { TrackStateService } from './track-state.service.js';

const NOT_FOUND =
  'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
  '(`RESOURCE_MOVED`).';

@ApiTags('favorites')
@Controller('me')
export class FavoritesController {
  constructor(
    private readonly favorites: FavoritesService,
    private readonly state: TrackStateService,
  ) {}

  // Idempotent: favoriting a favorite changes nothing and answers the same.
  @Put('favorites/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The Track is a favorite.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async addFavorite(
    @CurrentUser() user: AuthUser,
    @Param() params: FavoriteTrackParamDto,
  ): Promise<void> {
    await this.favorites.add(user.id, params.trackId);
  }

  // Idempotent, like the add.
  @Delete('favorites/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The Track is not a favorite.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param() params: FavoriteTrackParamDto,
  ): Promise<void> {
    await this.favorites.remove(user.id, params.trackId);
  }

  @Get('tracks/:trackId')
  @ZodSerializerDto(trackPracticeStateSchema)
  @ApiOkResponse({ description: 'What the User has with the Track.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  getTrackState(
    @CurrentUser() user: AuthUser,
    @Param() params: FavoriteTrackParamDto,
  ): Promise<TrackPracticeState> {
    return this.state.getState(user.id, params.trackId);
  }
}
