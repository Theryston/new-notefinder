import { trackIdParamSchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class TrackIdParamDto extends createZodDto(trackIdParamSchema) {}
