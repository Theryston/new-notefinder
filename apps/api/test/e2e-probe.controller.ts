import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { cursorPaginationQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../src/common/zod/create-zod-dto.js';
import { ZodSerializerDto } from '../src/common/zod/zod-serializer.interceptor.js';

export class ProbeDto extends createZodDto(cursorPaginationQuerySchema) {}

/**
 * Test-only route that exercises the global validation pipe and response
 * serializer. It lives outside `*.e2e-spec.ts` because Biome's test override
 * currently drops the parameter-decorator parser option for spec files.
 */
@Controller('e2e-probe')
export class E2eProbeController {
  @Get()
  @ZodSerializerDto(ProbeDto)
  list(@Query() query: ProbeDto) {
    return query;
  }

  @Post()
  @ZodSerializerDto(ProbeDto)
  echo(@Body() body: ProbeDto) {
    return { ...body, internalField: 'must not leak' };
  }
}
