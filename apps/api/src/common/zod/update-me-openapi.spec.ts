import { Body, Controller, type INestApplication, Patch } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  DAILY_PRACTICE_TARGET_SECONDS,
  updateMeBodySchema,
} from '@vozzify/contracts';
import { createOpenApiDocument } from '../../setup-app.js';
import { createZodDto } from './create-zod-dto.js';

class UpdateMeProbeBody extends createZodDto(updateMeBodySchema) {}

@Controller('probe')
class UpdateMeProbeController {
  @Patch()
  update(@Body() _body: UpdateMeProbeBody) {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const documentedTarget = (document: OpenAPIObject): unknown => {
  const schema = document.components?.schemas?.UpdateMeProbeBody;
  return isRecord(schema) && isRecord(schema.properties)
    ? schema.properties.dailyPracticeTargetSeconds
    : undefined;
};

/** Whether a client that trusts the OpenAPI node would send `value`. */
const documentedAccepts = (node: unknown) => {
  if (!isRecord(node) || !Array.isArray(node.anyOf)) {
    throw new Error('The OpenAPI document does not describe the Daily target');
  }
  const accepted = new Set(
    node.anyOf.flatMap((branch) =>
      isRecord(branch) && Array.isArray(branch.enum) ? branch.enum : [],
    ),
  );
  return (value: unknown): boolean => accepted.has(value);
};

// Every preset, its neighbors, and the non-numbers a text part could be.
const probes = (): unknown[] => [
  ...DAILY_PRACTICE_TARGET_SECONDS,
  0,
  15,
  299,
  301,
  599,
  601,
  899,
  901,
  1799,
  1801,
  3600,
  -300,
  300.5,
  Number.NaN,
  null,
  '600',
  '',
];

describe('Daily target in the OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UpdateMeProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents exactly what the contract accepts', () => {
    const accepts = documentedAccepts(documentedTarget(document));
    const field = updateMeBodySchema.shape.dailyPracticeTargetSeconds;

    const disagreements = probes().filter(
      (value) => accepts(value) !== field.safeParse(value).success,
    );

    expect(disagreements).toEqual([]);
  });

  it('documents the target as optional', () => {
    const schema = document.components?.schemas?.UpdateMeProbeBody;

    expect(isRecord(schema) ? schema.required : undefined).toEqual(['name']);
    expect(updateMeBodySchema.safeParse({ name: 'Ada King' }).success).toBe(
      true,
    );
  });
});
