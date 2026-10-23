import { Body, Controller, HttpStatus, Param, Post, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type TrackView, trackViewSchema } from '@notefinder/contracts';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { RecordTrackViewBodyDto } from './record-track-view-body.dto.js';
import { TrackIdParamDto } from './track-id-param.dto.js';
import { TrackViewsService } from './track-views.service.js';

@ApiTags('tracks')
@Controller('tracks')
export class TrackViewsController {
  constructor(private readonly views: TrackViewsService) {}

  // Public: a visitor's view counts too. A signed-in User is recorded with the
  // view, and posting the stored view ID after signing in attaches them.
  @Public()
  @Post(':trackId/views')
  @ZodSerializerDto(trackViewSchema)
  @ApiCreatedResponse({ description: 'The view was recorded.' })
  @ApiOkResponse({
    description:
      'The view ID names a view of the Track: the signed-in User, if any, ' +
      'was attached to it and nothing new was recorded.',
  })
  @ApiBadRequestResponse({ description: 'The ID or the body is bad.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  async recordView(
    @CurrentUser() user: AuthUser | undefined,
    @Param() params: TrackIdParamDto,
    @Body() body: RecordTrackViewBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TrackView> {
    const recorded = await this.views.record({
      trackId: params.trackId,
      userId: user?.id,
      viewId: body.viewId,
      clickId: body.clickId,
      visitorId: body.visitorId,
      locale: body.locale,
    });
    response.status(recorded.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { viewId: recorded.viewId };
  }
}
