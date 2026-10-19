import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type PublicProfileSummary,
  publicProfileSummarySchema,
} from '@notefinder/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { ProfileVisibilityService } from '../users/profile-visibility.service.js';
import { ProfileSummaryService } from './profile-summary.service.js';
import { PublicProfileSummaryParamDto } from './profile-summary-param.dto.js';

// Anonymous, like the banner: the numbers are public by contract.
@ApiTags('users')
@Public()
@Controller('users')
export class ProfileSummaryController {
  constructor(
    private readonly profileVisibility: ProfileVisibilityService,
    private readonly profileSummary: ProfileSummaryService,
  ) {}

  @Get(':username/summary')
  @ZodSerializerDto(publicProfileSummarySchema)
  @ApiOkResponse({ description: 'The numbers of the Profile Summary section.' })
  @ApiNotFoundResponse({
    description:
      'No User has this username, or the owner hid this section (`NOT_FOUND`).',
  })
  async getSummary(
    @Param() params: PublicProfileSummaryParamDto,
    @CurrentUser() viewer: AuthUser | undefined,
  ): Promise<PublicProfileSummary> {
    const view = await this.profileVisibility.readSection(
      params.username,
      'summary',
      viewer?.id,
    );
    return this.profileSummary.getSummary(view.userId, view.shown);
  }
}
