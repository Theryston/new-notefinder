import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type CreateTrackResult,
  createTrackResultSchema,
  type TrackContributorsPage,
  type TrackDetail,
  type TrackNotes,
  type TrackProcessingState,
  trackContributorsPageSchema,
  trackDetailSchema,
  trackNotesSchema,
  trackProcessingStateSchema,
} from '@vozzify/contracts';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { CreateTrackBodyDto } from './create-track-body.dto.js';
import { RetryTrackBodyDto } from './retry-track-body.dto.js';
import { TrackContributorsQueryDto } from './track-contributors-query.dto.js';
import { TrackIdParamDto } from './track-id-param.dto.js';
import { TrackPracticeService } from './track-practice.service.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestFlowService } from './track-request-flow.service.js';
import { TrackRetryLauncherService } from './track-retry-launcher.service.js';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(
    private readonly trackRequests: TrackRequestFlowService,
    private readonly trackProcessing: TrackProcessingService,
    private readonly trackPractice: TrackPracticeService,
    private readonly trackRetries: TrackRetryLauncherService,
  ) {}

  // A Recording becomes a Track on the first request (202, its Processing is
  // queued); a Recording that already has one answers 200 with that Track.
  @Post()
  @ZodSerializerDto(createTrackResultSchema)
  @ApiAcceptedResponse({
    description: 'The Track was created and its Processing queued.',
  })
  @ApiOkResponse({
    description: 'The Recording already has a Track; nothing was written.',
  })
  @ApiBadRequestResponse({ description: 'The Recording or the locale is bad.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The user has no username yet.' })
  @ApiNotFoundResponse({
    description: 'The Music catalog does not know the Recording.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'The User reached a limit on Track requests (`PROCESSING_LIMIT_REACHED`, ' +
      'with the limit in `details`). Admins are exempt.',
  })
  @ApiServiceUnavailableResponse({ description: 'The Music catalog is down.' })
  @ApiGatewayTimeoutResponse({
    description: 'The Music catalog took too long.',
  })
  async requestTrack(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTrackBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateTrackResult> {
    const requested = await this.trackRequests.requestTrack(user, body);
    response.status(requested.created ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return { trackId: requested.trackId };
  }

  // Public: the practice page of a Track. A legacy ID answers 404
  // `RESOURCE_MOVED` with the new ID, an unknown one 404 `NOT_FOUND`.
  @Public()
  @Get(':trackId')
  @ZodSerializerDto(trackDetailSchema)
  @ApiOkResponse({
    description:
      'The practice header: title, artist credit, cover, duration, YouTube ' +
      'video, Contributors and whether the Track has vocal notes.',
  })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getTrack(@Param() params: TrackIdParamDto): Promise<TrackDetail> {
    return this.trackPractice.getHeader(params.trackId);
  }

  // Public: the vocal notes in the order they are sung; empty for a Track
  // without any. Same 404s as the header.
  @Public()
  @Get(':trackId/notes')
  @ZodSerializerDto(trackNotesSchema)
  @ApiOkResponse({ description: 'The Track vocal notes in sung order.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getNotes(@Param() params: TrackIdParamDto): Promise<TrackNotes> {
    return this.trackPractice.getNotes(params.trackId);
  }

  // Public: the Track's Contributors in first-contribution order,
  // cursor-paginated, with the total for the counter. Same 404s as the header.
  // A signed-in viewer also gets whether they follow each Contributor.
  @Public()
  @Get(':trackId/contributors')
  @ZodSerializerDto(trackContributorsPageSchema)
  @ApiOkResponse({
    description: "The Track's Contributors, paginated, with their total.",
  })
  @ApiBadRequestResponse({ description: 'The cursor, limit or query is bad.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getContributors(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param() params: TrackIdParamDto,
    @Query() query: TrackContributorsQueryDto,
  ): Promise<TrackContributorsPage> {
    return this.trackProcessing.listContributors(
      params.trackId,
      query,
      viewer?.id,
    );
  }

  // Public: the page is shared while the Track processes. A legacy ID answers
  // 404 `RESOURCE_MOVED` with the new ID, an unknown one 404 `NOT_FOUND`.
  @Public()
  @Get(':trackId/processing')
  @ZodSerializerDto(trackProcessingStateSchema)
  @ApiOkResponse({
    description: 'The Track header, its latest Processing and Contributors.',
  })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getProcessing(
    @Param() params: TrackIdParamDto,
  ): Promise<TrackProcessingState> {
    return this.trackProcessing.getProcessingState(params.trackId);
  }

  // Starts a new Processing of a failed Track from the step that failed (202).
  // Only a retryable failure qualifies (`CONFLICT` otherwise), and the User
  // becomes a Contributor of the Track.
  @Post(':trackId/processing/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(trackProcessingStateSchema)
  @ApiAcceptedResponse({
    description: 'The retry started; its Processing is queued.',
  })
  @ApiBadRequestResponse({ description: 'The locale or the ID is bad.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The user has no username yet.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  @ApiConflictResponse({
    description:
      'The latest Processing is not a retryable failure (`CONFLICT`).',
  })
  @ApiTooManyRequestsResponse({
    description:
      'The User reached the limit of active Processings ' +
      '(`PROCESSING_LIMIT_REACHED`). Admins are exempt.',
  })
  retryProcessing(
    @CurrentUser() user: AuthUser,
    @Param() params: TrackIdParamDto,
    @Body() body: RetryTrackBodyDto,
  ): Promise<TrackProcessingState> {
    return this.trackRetries.retry(user, params.trackId, body);
  }
}
