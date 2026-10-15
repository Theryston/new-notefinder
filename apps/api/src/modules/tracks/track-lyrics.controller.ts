import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type TrackLyrics, trackLyricsSchema } from '@notefinder/contracts';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import { TrackIdParamDto } from './track-id-param.dto.js';
import { TrackLyricsService } from './track-lyrics.service.js';

@ApiTags('tracks')
@Controller('tracks')
export class TrackLyricsController {
  constructor(private readonly lyrics: TrackLyricsService) {}

  // Public: the Timed lyrics in the order they are sung; no lines for a Track
  // without any. A legacy ID answers 404 `RESOURCE_MOVED` with the new ID, an
  // unknown one 404 `NOT_FOUND`.
  @Public()
  @Get(':trackId/lyrics')
  @ZodSerializerDto(trackLyricsSchema)
  @ApiOkResponse({ description: 'The Track Timed lyrics: lines with words.' })
  @ApiNotFoundResponse({
    description:
      'Unknown ID (`NOT_FOUND`), or a legacy ID with its new ID ' +
      '(`RESOURCE_MOVED`).',
  })
  getLyrics(@Param() params: TrackIdParamDto): Promise<TrackLyrics> {
    return this.lyrics.getLyrics(params.trackId);
  }
}
