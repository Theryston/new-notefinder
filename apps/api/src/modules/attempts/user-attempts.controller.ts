import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { PracticeAttemptHistoryPage } from '@notefinder/contracts';
import { practiceAttemptHistoryPageSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { ListUserAttemptsQueryDto } from './list-user-attempts-query.dto.js';
import { UserAttemptsService } from './user-attempts.service.js';
import { UserAttemptsParamDto } from './user-attempts-param.dto.js';

// Anonymous: a Profile's history is public, like the Profile itself.
@ApiTags('attempts')
@Public()
@Controller('users')
export class UserAttemptsController {
  constructor(private readonly userAttempts: UserAttemptsService) {}

  @Get(':username/attempts')
  @ZodSerializerDto(practiceAttemptHistoryPageSchema)
  @ApiOkResponse({
    description: "The User's practice history, newest first.",
  })
  @ApiBadRequestResponse({
    description: 'The cursor is not one this API issued.',
  })
  @ApiNotFoundResponse({
    description: 'No User has this username (`NOT_FOUND`).',
  })
  listHistory(
    @Param() params: UserAttemptsParamDto,
    @Query() query: ListUserAttemptsQueryDto,
  ): Promise<PracticeAttemptHistoryPage> {
    return this.userAttempts.listHistory(params.username, query);
  }
}
