import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('health')
// Probed frequently by Coolify and the CDN; must never be rate limited.
@SkipThrottle()
@Controller('health')
export class HealthController {
  // Public liveness probe used by Coolify healthchecks.
  @Get()
  @ApiOkResponse({ description: 'The API process is up.' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
