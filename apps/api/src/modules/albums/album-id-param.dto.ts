import { albumIdParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class AlbumIdParamDto extends createZodDto(albumIdParamSchema) {}
