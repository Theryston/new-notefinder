import { artistIdParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ArtistIdParamDto extends createZodDto(artistIdParamSchema) {}
