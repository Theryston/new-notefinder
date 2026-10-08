import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type CreateTrackResult,
  createTrackResultSchema,
  type TrackProcessingState,
  trackProcessingStateSchema,
} from '@notefinder/contracts';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { CreateTrackBodyDto } from './create-track-body.dto.js';
import { TrackIdParamDto } from './track-id-param.dto.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TrackRequestService } from './track-request.service.js';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(
    private readonly trackRequests: TrackRequestService,
    private readonly trackProcessing: TrackProcessingService,
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
  @ApiServiceUnavailableResponse({ description: 'The Music catalog is down.' })
  @ApiGatewayTimeoutResponse({
    description: 'The Music catalog took too long.',
  })
  async requestTrack(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTrackBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateTrackResult> {
    const requested = await this.trackRequests.requestTrack(user.id, body);
    response.status(requested.created ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return { trackId: requested.trackId };
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
}
