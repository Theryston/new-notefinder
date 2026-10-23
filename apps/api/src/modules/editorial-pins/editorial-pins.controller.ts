import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type EditorialPin,
  type EditorialPinActor,
  editorialPinHistoryPageSchema,
  editorialPinMetricsPageSchema,
  editorialPinPageSchema,
  editorialPinSchema,
} from '@notefinder/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import {
  CreateEditorialPinBodyDto,
  EditorialPinIdParamDto,
  EditorialPinPageQueryDto,
  UpdateEditorialPinBodyDto,
} from './editorial-pin-dtos.js';
import { EditorialPinMetricsService } from './editorial-pin-metrics.service.js';
import { EditorialPinsService } from './editorial-pins.service.js';

const adminActor = (user: AuthUser): EditorialPinActor => ({
  id: user.id,
  name: user.name,
});

/** The editorial pins of the home feed, for admins only. */
@ApiTags('admin')
@Roles('ADMIN')
@ApiUnauthorizedResponse({ description: 'No valid session.' })
@ApiForbiddenResponse({ description: 'The User is not an admin.' })
@Controller('admin/home-pins')
export class EditorialPinsController {
  constructor(
    private readonly pins: EditorialPinsService,
    private readonly metricsService: EditorialPinMetricsService,
  ) {}

  @Get('metrics')
  @ZodSerializerDto(editorialPinMetricsPageSchema)
  @ApiOkResponse({ description: 'Stored impressions, clicks and click rates.' })
  pinMetrics() {
    return this.metricsService.list();
  }

  @Get()
  @ZodSerializerDto(editorialPinPageSchema)
  @ApiOkResponse({ description: 'The pins, newest first, paginated.' })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  list(@Query() query: EditorialPinPageQueryDto) {
    return this.pins.list(query);
  }

  @Post()
  @ZodSerializerDto(editorialPinSchema)
  @ApiBadRequestResponse({
    description:
      'The pin is invalid, or it references a Track that cannot appear in it (`VALIDATION_FAILED`).',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateEditorialPinBodyDto,
  ): Promise<EditorialPin> {
    return this.pins.create(body, adminActor(user));
  }

  @Get(':pinId')
  @ZodSerializerDto(editorialPinSchema)
  @ApiOkResponse({ description: 'The pin.' })
  @ApiNotFoundResponse({ description: 'No pin has this ID (`NOT_FOUND`).' })
  get(@Param() params: EditorialPinIdParamDto): Promise<EditorialPin> {
    return this.pins.get(params.pinId);
  }

  @Patch(':pinId')
  @ZodSerializerDto(editorialPinSchema)
  @ApiOkResponse({ description: 'The pin after the change.' })
  @ApiBadRequestResponse({
    description:
      'The change is invalid, or it references a Track that cannot appear in the pin (`VALIDATION_FAILED`).',
  })
  @ApiNotFoundResponse({ description: 'No pin has this ID (`NOT_FOUND`).' })
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: EditorialPinIdParamDto,
    @Body() body: UpdateEditorialPinBodyDto,
  ): Promise<EditorialPin> {
    return this.pins.update(params.pinId, body, adminActor(user));
  }

  @Delete(':pinId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The pin is removed.' })
  @ApiNotFoundResponse({ description: 'No pin has this ID (`NOT_FOUND`).' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param() params: EditorialPinIdParamDto,
  ): Promise<void> {
    await this.pins.remove(params.pinId, adminActor(user));
  }

  @Get(':pinId/history')
  @ZodSerializerDto(editorialPinHistoryPageSchema)
  @ApiOkResponse({
    description:
      'Every change of the pin, newest first, with who made it. Kept after the pin is removed.',
  })
  @ApiBadRequestResponse({ description: 'The cursor or limit is bad.' })
  history(
    @Param() params: EditorialPinIdParamDto,
    @Query() query: EditorialPinPageQueryDto,
  ) {
    return this.pins.history(params.pinId, query);
  }
}
