import { z } from 'zod';

// Minimal in-house replacement for nestjs-zod's `createZodDto`: nestjs-zod
// 5.x declares peer support only up to NestJS 11 / @nestjs/swagger 11.

type JsonSchema = Record<string, unknown>;

export type ZodDto<TSchema extends z.ZodType = z.ZodType> = {
  new (): z.output<TSchema>;
  readonly schema: TSchema;
  readonly isZodDto: true;
};

const zodDtoClasses = new Set<ZodDto>();

/** DTO classes whose OpenAPI schema was requested by @nestjs/swagger. */
export const getRegisteredZodDtos = (): ReadonlySet<ZodDto> => zodDtoClasses;

export const toOpenApiSchema = (schema: z.ZodType): JsonSchema => {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  });
  return jsonSchema;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Builds the per-property metadata @nestjs/swagger reads from
 * `_OPENAPI_METADATA_FACTORY`. It is what Swagger uses to expand query/param
 * DTOs into individual parameters; body and response components are replaced
 * by the exact JSON Schema in `cleanupOpenApiDoc`.
 */
const toSwaggerPropertyMetadata = (
  schema: z.ZodType,
): Record<string, JsonSchema> => {
  const jsonSchema = toOpenApiSchema(schema);
  const properties = isRecord(jsonSchema.properties)
    ? jsonSchema.properties
    : {};
  const required = Array.isArray(jsonSchema.required)
    ? jsonSchema.required
    : [];
  return Object.fromEntries(
    Object.entries(properties).map(([key, property]) => [
      key,
      {
        ...(isRecord(property) ? property : {}),
        required: required.includes(key),
      },
    ]),
  );
};

/**
 * Creates a DTO class from a Zod schema (always one from
 * `@notefinder/contracts`). The global `ZodValidationPipe` validates and
 * parses any argument typed with it:
 *
 * `class ListTracksQueryDto extends createZodDto(listTracksQuerySchema) {}`
 */
export const createZodDto = <TSchema extends z.ZodType>(
  schema: TSchema,
): ZodDto<TSchema> => {
  // biome-ignore lint/complexity/noStaticOnlyClass: DTOs must be classes (Nest reads their constructor from decorator metadata) and carry the schema statically.
  class ZodDtoBase {
    static readonly schema = schema;
    static readonly isZodDto = true as const;

    static _OPENAPI_METADATA_FACTORY(this: ZodDto<TSchema>) {
      // biome-ignore lint/complexity/noThisInStatic: `this` is the concrete subclass Swagger is documenting, not ZodDtoBase.
      zodDtoClasses.add(this);
      return toSwaggerPropertyMetadata(schema);
    }
  }
  return ZodDtoBase as unknown as ZodDto<TSchema>;
};

export const isZodDto = (value: unknown): value is ZodDto =>
  typeof value === 'function' &&
  'isZodDto' in value &&
  value.isZodDto === true &&
  'schema' in value &&
  value.schema instanceof z.ZodType;
