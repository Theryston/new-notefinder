import { artistIdParamSchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ArtistIdParamDto extends createZodDto(artistIdParamSchema) {}
