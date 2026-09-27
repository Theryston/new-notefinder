import {
  type ArgumentMetadata,
  HttpException,
  HttpStatus,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { z } from 'zod';
import { isZodDto } from './create-zod-dto.js';

/** Raised when a request argument fails its DTO schema. */
export class ZodValidationException extends HttpException {
  constructor(
    readonly zodError: z.ZodError,
    readonly location: ArgumentMetadata['type'],
  ) {
    super('Request validation failed', HttpStatus.BAD_REQUEST);
  }
}

/**
 * Validates and parses (applying coercions/defaults) every handler argument
 * whose declared type is a `createZodDto` class. Other arguments pass through.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata) {
    if (!isZodDto(metadata.metatype)) {
      return value;
    }
    const result = await metadata.metatype.schema.safeParseAsync(value);
    if (!result.success) {
      throw new ZodValidationException(result.error, metadata.type);
    }
    return result.data;
  }
}
