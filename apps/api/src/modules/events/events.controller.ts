import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import {
  type RecordEventsResponse,
  recordEventsResponseSchema,
} from '@vozzify/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { EventsService } from './events.service.js';
import { EventsVisitorThrottleGuard } from './events-visitor-throttle.guard.js';
import { RecordEventsBodyDto } from './record-events-body.dto.js';

/** Raw engagement events, buffered in Redis and answered at once. */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // Public: anonymous visits count too, identified by their visitor id. A
  // signed-in batch also carries the User. Bot batches are dropped after the
  // 202 (accepted 0), so crawlers neither pollute the table nor learn they
  // were ignored. The tighter per-IP limit keeps a flood of batches a queue
  // problem, never a database one, and the per-visitor guard keeps one device
  // from spending the whole IP budget.
  @Public()
  @Post()
  @HttpCode(202)
  @UseGuards(EventsVisitorThrottleGuard)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @ZodSerializerDto(recordEventsResponseSchema)
  @ApiAcceptedResponse({ description: 'The batch was queued for storing.' })
  @ApiBadRequestResponse({
    description: 'The batch is oversized or an event is invalid.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Per-IP or per-visitor events rate exceeded.',
  })
  record(
    @Body() body: RecordEventsBodyDto,
    @CurrentUser() user: AuthUser | undefined,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<RecordEventsResponse> {
    return this.events.record({
      visitorId: body.visitorId,
      userId: user?.id,
      userAgent,
      events: body.events,
    });
  }
}
