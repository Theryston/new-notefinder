import { listTracksQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class ListTracksQueryDto extends createZodDto(listTracksQuerySchema) {}
