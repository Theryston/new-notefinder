import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.js';
import { FollowedUserParamDto } from './follow-user-param.dto.js';
import { FollowWritesService } from './follow-writes.service.js';

/** The signed-in User's follows. */
@ApiTags('users')
@Controller('me')
export class FollowsController {
  constructor(private readonly followWrites: FollowWritesService) {}

  // Idempotent: following someone already followed changes nothing.
  @Put('following/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The User is followed.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({
    description:
      'The signed-in User has no username yet (`USERNAME_REQUIRED`).',
  })
  @ApiBadRequestResponse({
    description: 'The User tried to follow themselves.',
  })
  @ApiNotFoundResponse({ description: 'No User has this ID (`NOT_FOUND`).' })
  async follow(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowedUserParamDto,
  ): Promise<void> {
    await this.followWrites.follow(user.id, params.userId);
  }

  // Idempotent, like the follow.
  @Delete('following/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The User is not followed.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({
    description:
      'The signed-in User has no username yet (`USERNAME_REQUIRED`).',
  })
  @ApiNotFoundResponse({ description: 'No User has this ID (`NOT_FOUND`).' })
  async unfollow(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowedUserParamDto,
  ): Promise<void> {
    await this.followWrites.unfollow(user.id, params.userId);
  }
}
