import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  adminBenefitSchema,
  adminBenefitsSchema,
  benefitIdParamSchema,
  benefitPlanIdParamSchema,
  benefitPlanSchema,
  benefitPlansSchema,
  setPlanBenefitsBodySchema,
  writeBenefitBodySchema,
} from '@notefinder/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { AdminBenefitsService } from './admin-benefits.service.js';

class WriteBenefitDto extends createZodDto(writeBenefitBodySchema) {}
class BenefitIdDto extends createZodDto(benefitIdParamSchema) {}
class PlanIdDto extends createZodDto(benefitPlanIdParamSchema) {}
class SetPlanBenefitsDto extends createZodDto(setPlanBenefitsBodySchema) {}

@ApiTags('admin')
@Roles('ADMIN')
@ApiUnauthorizedResponse({ description: 'No valid session.' })
@ApiForbiddenResponse({ description: 'The User is not an admin.' })
@Controller('admin/benefits')
export class AdminBenefitsController {
  constructor(private readonly service: AdminBenefitsService) {}

  @Get()
  @ZodSerializerDto(adminBenefitsSchema)
  list() {
    return this.service.list();
  }

  @Get(':benefitId')
  @ZodSerializerDto(adminBenefitSchema)
  get(@Param() params: BenefitIdDto) {
    return this.service.get(params.benefitId);
  }

  @Post()
  @ZodSerializerDto(adminBenefitSchema)
  create(@Body() body: WriteBenefitDto) {
    return this.service.create(body);
  }

  @Patch(':benefitId')
  @ZodSerializerDto(adminBenefitSchema)
  update(@Param() params: BenefitIdDto, @Body() body: WriteBenefitDto) {
    return this.service.update(params.benefitId, body);
  }

  @Delete(':benefitId')
  @HttpCode(204)
  remove(@Param() params: BenefitIdDto) {
    return this.service.remove(params.benefitId);
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@ApiUnauthorizedResponse({ description: 'No valid session.' })
@ApiForbiddenResponse({ description: 'The User is not an admin.' })
@Controller('admin/plan-benefits')
export class AdminPlanBenefitsController {
  constructor(private readonly service: AdminBenefitsService) {}

  @Get()
  @ZodSerializerDto(benefitPlansSchema)
  list() {
    return this.service.listPlans();
  }

  @Put(':planId')
  @ZodSerializerDto(benefitPlanSchema)
  update(@Param() params: PlanIdDto, @Body() body: SetPlanBenefitsDto) {
    return this.service.setPlanBenefits(params.planId, body.benefitIds);
  }
}
