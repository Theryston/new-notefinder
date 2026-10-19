import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { PublicProfile } from '@notefinder/contracts';
import { publicProfileSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { PublicProfileService } from './public-profile.service.js';
import { PublicProfileParamDto } from './public-profile-param.dto.js';

// Anonymous: visitors open profiles from shared links and search engines.
@ApiTags('users')
@Public()
@Controller('users')
export class UserProfileController {
  constructor(private readonly publicProfileService: PublicProfileService) {}

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
}
