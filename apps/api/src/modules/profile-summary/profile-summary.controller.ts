import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type PublicProfileSummary,
  publicProfileSummarySchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { UsersService } from '../users/users.service.js';
import { ProfileSummaryService } from './profile-summary.service.js';
import { PublicProfileSummaryParamDto } from './profile-summary-param.dto.js';

// Anonymous, like the banner: the numbers are public by contract.
@ApiTags('users')
@Public()
@Controller('users')
export class ProfileSummaryController {
  constructor(
    private readonly users: UsersService,
    private readonly profileSummary: ProfileSummaryService,
  ) {}

  @Get(':username/summary')
  @ZodSerializerDto(publicProfileSummarySchema)
  @ApiOkResponse({ description: 'The numbers of the Profile Summary section.' })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  async getSummary(
    @Param() params: PublicProfileSummaryParamDto,
  ): Promise<PublicProfileSummary> {
    const userId = await this.users.findIdByUsername(params.username);
    return this.profileSummary.getSummary(userId);
  }
}
