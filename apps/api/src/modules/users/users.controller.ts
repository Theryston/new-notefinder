import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type CurrentUser as CurrentUserBody,
  currentUserSchema,
  type ProfileVisibility,
  profileVisibilitySchema,
} from '@notefinder/contracts';
import { AllowMissingUsername } from '../../common/decorators/allow-missing-username.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor.js';
import { ProfileVisibilityService } from './profile-visibility.service.js';
import { SetUsernameBodyDto } from './set-username.dto.js';
import { UpdateMeBodyDto } from './update-me.dto.js';
import { UpdateProfileVisibilityBodyDto } from './update-profile-visibility.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profileVisibility: ProfileVisibilityService,
  ) {}

  // The client reads `username: null` here to send the user to pick one.
  @AllowMissingUsername()
  @Get()
  @ZodSerializerDto(currentUserSchema)
  @ApiOkResponse({ description: 'The signed-in user.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  getMe(@CurrentUser() user: AuthUser): Promise<CurrentUserBody> {
    return this.usersService.getCurrentUser(user.id);
  }

  // Multipart: the Name as a text field, the optional Avatar as a file.
  @Patch()
  @UseInterceptors(AvatarUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ZodSerializerDto(currentUserSchema)
  @ApiOkResponse({ description: 'The signed-in user, updated.' })
  @ApiBadRequestResponse({
    description:
      'The Name is empty or too long, the Daily target is not one of the ' +
      'presets, or the Avatar is over 5 MB or not a PNG, JPEG or WEBP image.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The user has no username yet.' })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateMeBodyDto,
  ): Promise<CurrentUserBody> {
    return this.usersService.updateProfile(user.id, body);
  }

  // For users who have no username yet; it is the setup step the client
  // sends them to (`USERNAME_REQUIRED`).
  @AllowMissingUsername()
  @Put('username')
  @ZodSerializerDto(currentUserSchema)
  @ApiOkResponse({ description: 'The user, with the username set.' })
  @ApiBadRequestResponse({ description: 'The username is not valid.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiConflictResponse({
    description: 'The user already has a username, or another user has it.',
  })
  setUsername(
    @CurrentUser() user: AuthUser,
    @Body() body: SetUsernameBodyDto,
  ): Promise<CurrentUserBody> {
    return this.usersService.setUsername(user.id, body.username);
  }

  // The owner's flags for the Profile sections (`profile-visibility` in the
  // session): the owner's page reads them to show its toggles.
  @Get('profile-visibility')
  @ZodSerializerDto(profileVisibilitySchema)
  @ApiOkResponse({ description: 'Whether each Profile section is visible.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  getProfileVisibility(
    @CurrentUser() user: AuthUser,
  ): Promise<ProfileVisibility> {
    return this.profileVisibility.getVisibility(user.id);
  }

  // A partial update: an absent section keeps its flag.
  @Patch('profile-visibility')
  @ZodSerializerDto(profileVisibilitySchema)
  @ApiOkResponse({ description: 'The flags of every section, updated.' })
  @ApiBadRequestResponse({ description: 'A flag is not a boolean.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The user has no username yet.' })
  updateProfileVisibility(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileVisibilityBodyDto,
  ): Promise<ProfileVisibility> {
    return this.profileVisibility.updateVisibility(user.id, body);
  }
}
