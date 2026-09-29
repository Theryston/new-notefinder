import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Put,
  Query,
} from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  setUsernameBodySchema,
  USERNAME_MAX_LENGTH,
  usernameSchema,
} from '@notefinder/contracts';
import { z } from 'zod';
import { createOpenApiDocument } from '../../setup-app.js';
import { createZodDto } from './create-zod-dto.js';

class SetUsernameBody extends createZodDto(setUsernameBodySchema) {}

class UsernameQuery extends createZodDto(
  z.object({ username: usernameSchema }),
) {}

@Controller('probe')
class UsernameProbeController {
  @Put()
  setInBody(@Body() body: SetUsernameBody) {
    return body;
  }

  @Get()
  findInQuery(@Query() query: UsernameQuery) {
    return query;
  }
}

type DocumentedUsername = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const documentedBodyUsername = (document: OpenAPIObject): unknown => {
  const schema = document.components?.schemas?.SetUsernameBody;
  return isRecord(schema) && isRecord(schema.properties)
    ? schema.properties.username
    : undefined;
};

const documentedQueryUsername = (document: OpenAPIObject): unknown => {
  const parameters = document.paths['/probe']?.get?.parameters ?? [];
  const parameter = parameters.find(
    (candidate) => isRecord(candidate) && candidate.name === 'username',
  );
  return isRecord(parameter) ? parameter.schema : undefined;
};

const asDocumentedUsername = (node: unknown): DocumentedUsername => {
  if (!isRecord(node)) {
    throw new Error('The OpenAPI document does not describe the Username');
  }
  return node;
};

/** Whether a client that trusts the OpenAPI node would send `value`. */
const documentedAccepts = (documented: DocumentedUsername) => {
  const { minLength = 0, maxLength = Number.POSITIVE_INFINITY } = documented;
  const pattern = new RegExp(documented.pattern ?? '');
  return (value: string): boolean =>
    value.length >= minLength &&
    value.length <= maxLength &&
    pattern.test(value);
};

// Every UTF-16 code unit between two letters (so `trim` can't hide it), plus
// every length up to just past the contract's limit (so a limit missing from
// the document shows up too).
const probes = (): string[] => {
  const characters = Array.from(
    { length: 0x10000 },
    (_, unit) => `ab${String.fromCharCode(unit)}c`,
  );
  const lengths = Array.from({ length: USERNAME_MAX_LENGTH + 3 }, (_, length) =>
    'a'.repeat(length),
  );
  return [...characters, ...lengths];
};

describe('Username in the OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsernameProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each([
    ['a request body', documentedBodyUsername],
    ['a query parameter', documentedQueryUsername],
  ])('as %s', (_location, locate) => {
    it('accepts exactly what the contract accepts', () => {
      const documented = asDocumentedUsername(locate(document));
      const accepts = documentedAccepts(documented);

      const disagreements = probes().filter(
        (value) => accepts(value) !== usernameSchema.safeParse(value).success,
      );

      expect(disagreements).toEqual([]);
    });

    it('accepts letters in either case, like the API does', () => {
      const accepts = documentedAccepts(asDocumentedUsername(locate(document)));

      expect(usernameSchema.safeParse('MixedCase_42').success).toBe(true);
      expect(accepts('MixedCase_42')).toBe(true);
    });
  });
});
