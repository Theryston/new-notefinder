import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ProfileVisibility, PublicProfile } from '@vozzify/contracts';
import {
  profileVisibilitySchema,
  publicProfileSchema,
} from '@vozzify/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ProfileVisibilityService } from '../users/profile-visibility.service.js';
import { PublicProfileService } from './public-profile.service.js';
import { PublicProfileParamDto } from './public-profile-param.dto.js';

// Anonymous: visitors open profiles from shared links and search engines.
@ApiTags('users')
@Public()
@Controller('users')
export class UserProfileController {
  constructor(
    private readonly publicProfileService: PublicProfileService,
    private readonly profileVisibility: ProfileVisibilityService,
  ) {}

  @Get(':username')
  @ZodSerializerDto(publicProfileSchema)
  @ApiOkResponse({ description: 'The public banner of the Profile.' })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getPublicProfile(
    @Param() params: PublicProfileParamDto,
  ): Promise<PublicProfile> {
    return this.publicProfileService.getPublicProfile(params.username);
  }

  // Which sections visitors see, so the cached Profile page leaves a hidden
  // section out of its first paint. A visitor can already tell the same from
  // the sections' own `NOT_FOUND`; this answers it once, without their data.
  @Get(':username/sections')
  @ZodSerializerDto(profileVisibilitySchema)
  @ApiOkResponse({
    description: 'Whether each section of the Profile is shown to visitors.',
  })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  getShownSections(
    @Param() params: PublicProfileParamDto,
  ): Promise<ProfileVisibility> {
    return this.profileVisibility.getShownSections(params.username);
  }
}
