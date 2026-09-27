import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import type { z } from 'zod';
import { isZodDto, type ZodDto } from './create-zod-dto.js';

const ZOD_SERIALIZER_SCHEMA = Symbol('ZOD_SERIALIZER_SCHEMA');

/**
 * Serializes the handler's return value through a contract schema, so fields
 * not declared in the contract (e.g. extra DB columns) never reach clients.
 */
export const ZodSerializerDto = (dtoOrSchema: ZodDto | z.ZodType) =>
  SetMetadata(
    ZOD_SERIALIZER_SCHEMA,
    isZodDto(dtoOrSchema) ? dtoOrSchema.schema : dtoOrSchema,
  );

/**
 * A response that does not match its own contract is a server bug, so the
 * exception filter reports it as `INTERNAL_ERROR` (and logs it).
 */
export class ZodSerializationException extends Error {
  constructor(readonly zodError: z.ZodError) {
    super('Response does not match its contract schema');
    this.name = 'ZodSerializationException';
  }
}

@Injectable()
export class ZodSerializerInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.getAllAndOverride<z.ZodType | undefined>(
      ZOD_SERIALIZER_SCHEMA,
      [context.getHandler(), context.getClass()],
    );
    if (!schema) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data: unknown) => {
        const result = schema.safeParse(data);
        if (!result.success) {
          throw new ZodSerializationException(result.error);
        }
        return result.data;
      }),
    );
  }
}
