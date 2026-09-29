import { Body, Controller, Get, Patch, UseInterceptors } from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type CurrentUser as CurrentUserBody,
  currentUserSchema,
} from '@notefinder/contracts';
import { AllowMissingUsername } from '../../common/decorators/allow-missing-username.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { UpdateMeBodyDto } from './update-me.dto.js';
import { UsersService } from './users.service.js';

// The form is a few short text fields until the Avatar file joins it, so
// anything bigger is rejected while it is being read, not after.
const UPDATE_ME_FORM_LIMITS = { fields: 8, fieldSize: 16 * 1024 };

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // The client reads `username: null` here to send the user to pick one.
  @AllowMissingUsername()
  @Get()
  @ZodSerializerDto(currentUserSchema)
  @ApiOkResponse({ description: 'The signed-in user.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  getMe(@CurrentUser() user: AuthUser): Promise<CurrentUserBody> {
    return this.usersService.getCurrentUser(user.id);
  }

  // Multipart from the start, so the Avatar file only adds a field. Until
  // then a file part is refused instead of silently dropped.
  @Patch()
  @UseInterceptors(NoFilesInterceptor({ limits: UPDATE_ME_FORM_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ZodSerializerDto(currentUserSchema)
  @ApiOkResponse({ description: 'The signed-in user, updated.' })
  @ApiBadRequestResponse({ description: 'The Name is empty or too long.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The user has no username yet.' })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateMeBodyDto,
  ): Promise<CurrentUserBody> {
    return this.usersService.updateProfile(user.id, body);
  }
}
