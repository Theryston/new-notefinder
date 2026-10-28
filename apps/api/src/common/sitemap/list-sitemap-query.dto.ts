import { sitemapQuerySchema } from '@vozzify/contracts';
import { createZodDto } from '../zod/create-zod-dto.js';

export class ListSitemapQueryDto extends createZodDto(sitemapQuerySchema) {}
