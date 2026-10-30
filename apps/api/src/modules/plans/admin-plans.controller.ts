import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminPlanCatalogSchema,
  adminPlanIdParamSchema,
  adminPlanSchema,
  saveAdminPlanBodySchema,
  updateContractingBodySchema,
} from '@vozzify/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { AdminPlansService } from './admin-plans.service.js';
import { PriceChangeRetryService } from './price-change-retry.service.js';

class SavePlanDto extends createZodDto(saveAdminPlanBodySchema) {}
class PlanParamDto extends createZodDto(adminPlanIdParamSchema) {}
class ContractingDto extends createZodDto(updateContractingBodySchema) {}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/plans')
export class AdminPlansController {
  constructor(
    private readonly plans: AdminPlansService,
    private readonly retries: PriceChangeRetryService,
  ) {}

  @Get()
  @ZodSerializerDto(adminPlanCatalogSchema)
  list() {
    return this.plans.list();
  }

  @Put('contracting')
  @ZodSerializerDto(adminPlanCatalogSchema)
  contracting(@Body() body: ContractingDto) {
    return this.plans.setContracting(body.contractingEnabled);
  }

  @Post()
  @ZodSerializerDto(adminPlanSchema)
  create(@Body() body: SavePlanDto) {
    return this.plans.create(body);
  }

  @Put(':planId')
  @ZodSerializerDto(adminPlanSchema)
  save(@Param() params: PlanParamDto, @Body() body: SavePlanDto) {
    return this.plans.save(params.planId, body);
  }

  @Post(':planId/price-changes/retry')
  @ZodSerializerDto(adminPlanCatalogSchema)
  async retryPriceChanges(@Param() params: PlanParamDto) {
    await this.retries.retryPlan(params.planId);
    return this.plans.list();
  }
}
