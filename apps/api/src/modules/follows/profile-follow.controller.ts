import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ProfileFollow } from '@vozzify/contracts';
import { profileFollowSchema } from '@vozzify/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { FollowsService } from './follows.service.js';
import { ProfileFollowParamDto } from './profile-follow-param.dto.js';

/**
 * What the signed-in viewer has with a Profile's User. Private (the default):
 * a visitor has no follow state, so the banner shows no button to them.
 */
@ApiTags('users')
@Controller('users')
export class ProfileFollowController {
  constructor(private readonly follows: FollowsService) {}

  @Get(':username/follow')
  @ZodSerializerDto(profileFollowSchema)
  @ApiOkResponse({ description: 'Whether the viewer follows the User.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({
    description:
      'The signed-in User has no username yet (`USERNAME_REQUIRED`).',
  })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getProfileFollow(
    @CurrentUser() user: AuthUser,
    @Param() params: ProfileFollowParamDto,
  ): Promise<ProfileFollow> {
    return this.follows.profileFollow(user.id, params.username);
  }
}
