import { searchQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
