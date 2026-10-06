import { searchQuerySchema } from '@notefinder/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
