import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type TrackAudio, trackAudioSchema } from '@vozzify/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodSerializerDto } from '../../common/zod/zod-serializer.interceptor.js';
import type { AuthUser } from '../auth/auth.js';
import { TrackDirectAudioService } from './track-direct-audio.service.js';
import { TrackIdParamDto } from './track-id-param.dto.js';

@ApiTags('tracks')
@Controller('tracks')
export class TrackDirectAudioController {
  constructor(private readonly audio: TrackDirectAudioService) {}

  // Public session resolution lets the licensing policy answer 403 for visitors too.
  @Public()
  @Get(':trackId/audio')
  @Header('Cache-Control', 'private, no-store')
  @ZodSerializerDto(trackAudioSchema)
  @ApiOkResponse({ description: 'Admin-only music and vocals MP3 URLs.' })
  @ApiForbiddenResponse({ description: 'Direct audio is restricted.' })
  getAudio(
    @Param() params: TrackIdParamDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TrackAudio> {
    return this.audio.getAudio(params.trackId, user);
  }
}
