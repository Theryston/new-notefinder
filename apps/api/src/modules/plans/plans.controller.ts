import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  listPlansQuerySchema,
  type PlanCatalog,
  planCatalogSchema,
} from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { PlansService } from './plans.service.js';

class ListPlansQueryDto extends createZodDto(listPlansQuerySchema) {}

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  @ZodSerializerDto(planCatalogSchema)
  @ApiOkResponse({
    description:
      'Public plan comparison in the selected locale and offer currency.',
  })
  getCatalog(@Query() query: ListPlansQueryDto): Promise<PlanCatalog> {
    return this.plans.getCatalog(query.locale);
  }
}
