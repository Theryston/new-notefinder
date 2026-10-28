import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type PracticeAttempt,
  practiceAttemptSchema,
} from '@vozzify/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { AttemptTrackParamDto } from './attempt-track-param.dto.js';
import { SubmitAttemptService } from './submit-attempt.service.js';
import { SubmitAttemptBodyDto } from './submit-attempt-body.dto.js';

const NOT_FOUND =
  'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
  '(`RESOURCE_MOVED`).';

@ApiTags('attempts')
@Controller('tracks/:trackId/attempts')
export class TrackAttemptsController {
  constructor(private readonly submitAttempts: SubmitAttemptService) {}

  // Only valid runs are saved: under 90% coverage or a forward skip is
  // refused with `ATTEMPT_REJECTED`, so no client can write a run the page
  // would never submit.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ZodSerializerDto(practiceAttemptSchema)
  @ApiCreatedResponse({ description: 'The saved attempt.' })
  @ApiBadRequestResponse({ description: 'The run is not valid.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiUnprocessableEntityResponse({
    description: 'The run covered too little or skipped forward.',
  })
  submitAttempt(
    @CurrentUser() user: AuthUser,
    @Param() params: AttemptTrackParamDto,
    @Body() body: SubmitAttemptBodyDto,
  ): Promise<PracticeAttempt> {
    return this.submitAttempts.submit(user.id, params.trackId, body);
  }
}
