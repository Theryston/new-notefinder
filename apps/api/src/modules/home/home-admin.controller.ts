import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  homePinPreviewRequestSchema,
  homePinPreviewResponseSchema,
} from '@notefinder/contracts';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { HomeService } from './home.service.js';

class HomePinPreviewBodyDto extends createZodDto(homePinPreviewRequestSchema) {}

/** Admin-only preview endpoint; the draft never reaches a stored feed. */
@ApiTags('admin')
@Roles('ADMIN')
@ApiUnauthorizedResponse({ description: 'No valid session.' })
@ApiForbiddenResponse({ description: 'The User is not an admin.' })
@Controller('admin/home-pins')
export class HomeAdminController {
  constructor(private readonly home: HomeService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(homePinPreviewResponseSchema)
  @ApiOkResponse({ description: 'The transient preview feed.' })
  @ApiBadRequestResponse({ description: 'The pin preview is invalid.' })
  async preview(
    @Body() body: HomePinPreviewBodyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.home.preview(body);
    response.setHeader('Cache-Control', 'private, no-store');
    return result.page;
  }
}
