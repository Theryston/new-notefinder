import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { type Readiness, readinessSchema } from './health.schemas.js';
import { HealthService } from './health.service.js';

@ApiTags('health')
// Probed frequently by Coolify and the CDN; must never be rate limited.
@SkipThrottle()
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Liveness: the process answers. Never touches dependencies, so a database
  // outage doesn't get healthy instances restarted.
  @Get()
  @ApiOkResponse({ description: 'The API process is up.' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  // Readiness: the instance can serve traffic (Postgres and Redis reachable).
  @Get('ready')
  @ZodSerializerDto(readinessSchema)
  @ApiOkResponse({ description: 'Every dependency is reachable.' })
  @ApiServiceUnavailableResponse({
    description: 'At least one dependency is unreachable (see `checks`).',
  })
  async ready(
    @Res({ passthrough: true }) response: Response,
  ): Promise<Readiness> {
    const readiness = await this.healthService.readiness();
    if (readiness.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return readiness;
  }
}
