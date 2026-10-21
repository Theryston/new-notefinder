import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type PinTrackSearchResult,
  pinTrackSearchResultSchema,
} from '@notefinder/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { PinTrackSearchQueryDto } from './editorial-pin-dtos.js';
import { EditorialPinsService } from './editorial-pins.service.js';

/**
 * Track lookup backing the pin pickers, for admins only. A text query lists
 * the completed Tracks a pin may hold (a hero only offers Tracks with a
 * cover); explicit IDs resolve the summaries of the Tracks an edited pin
 * already holds, so the picker shows them by name.
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/tracks')
export class AdminTracksController {
  constructor(private readonly pins: EditorialPinsService) {}

  @Get('search')
  @ZodSerializerDto(pinTrackSearchResultSchema)
  @ApiOkResponse({ description: 'Matching Tracks, hottest first.' })
  @ApiBadRequestResponse({
    description: 'Neither `q` nor `ids` was provided, or both were.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiForbiddenResponse({ description: 'The User is not an admin.' })
  search(
    @Query() query: PinTrackSearchQueryDto,
  ): Promise<PinTrackSearchResult> {
    return this.pins.searchPinTracks(query);
  }
}
