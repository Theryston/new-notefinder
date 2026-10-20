import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.js';
import { FollowWritesService } from './follow-writes.service.js';
import { RemoveFollowerParamDto } from './remove-follower-param.dto.js';

/** The followers of a Profile, as the Profile's own User manages them. */
@ApiTags('users')
@Controller('users')
export class ProfileFollowerController {
  constructor(private readonly followWrites: FollowWritesService) {}

  // Idempotent: removing a follower who is not following changes nothing.
  @Delete(':username/followers/:followerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The follower is removed.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({
    description:
      'The signed-in User is not the User of the Profile (`FORBIDDEN`), or has no username yet (`USERNAME_REQUIRED`).',
  })
  @ApiNotFoundResponse({
    description: 'No User has this username or follower ID (`NOT_FOUND`).',
  })
  async removeFollower(
    @CurrentUser() user: AuthUser,
    @Param() params: RemoveFollowerParamDto,
  ): Promise<void> {
    await this.followWrites.removeFollower(
      user.id,
      params.username,
      params.followerId,
    );
  }
}
