import { Controller, Get } from '@nestjs/common';
import {
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
import { UsersService } from './users.service.js';

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
}
