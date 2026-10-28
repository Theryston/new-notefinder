import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type PracticePreferences,
  practicePreferencesSchema,
} from '@vozzify/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { PracticePreferencesService } from './practice-preferences.service.js';
import { UpdatePracticePreferencesBodyDto } from './update-practice-preferences-body.dto.js';

@ApiTags('practice-preferences')
@Controller('me/practice-preferences')
export class PracticePreferencesController {
  constructor(private readonly preferences: PracticePreferencesService) {}

  @Get()
  @ZodSerializerDto(practicePreferencesSchema)
  @ApiOkResponse({
    description: "The User's practice preferences, or the defaults.",
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  getPreferences(@CurrentUser() user: AuthUser): Promise<PracticePreferences> {
    return this.preferences.get(user.id);
  }

  @Patch()
  @ZodSerializerDto(practicePreferencesSchema)
  @ApiOkResponse({ description: 'The updated practice preferences.' })
  @ApiBadRequestResponse({ description: 'A preference is not valid.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdatePracticePreferencesBodyDto,
  ): Promise<PracticePreferences> {
    return this.preferences.update(user.id, body);
  }
}
