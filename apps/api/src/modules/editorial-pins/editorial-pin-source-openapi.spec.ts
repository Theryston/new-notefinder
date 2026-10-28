import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  createEditorialPinBodySchema,
  editorialPinSourceSchema,
} from '@vozzify/contracts';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { createOpenApiDocument } from '../../setup-app.js';

class PinProbeBody extends createZodDto(createEditorialPinBodySchema) {}

@Controller('probe')
class PinProbeController {
  @Post()
  create(@Body() _body: PinProbeBody) {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const documentedSource = (document: OpenAPIObject): unknown => {
  const schema = document.components?.schemas?.PinProbeBody;
  return isRecord(schema) && isRecord(schema.properties)
    ? schema.properties.source
    : undefined;
};

describe('Pin sources in the OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PinProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the four sources the contract accepts', () => {
    const source = documentedSource(document);
    if (!isRecord(source) || !Array.isArray(source.oneOf)) {
      throw new Error('The OpenAPI document does not describe the source');
    }

    expect(source.oneOf).toHaveLength(4);
    for (const body of [
      { type: 'tracks', trackIds: ['t1'] },
      { type: 'genre', genre: 'rock' },
      { type: 'artist', artistId: 'artist-1' },
      { type: 'album', albumId: 'album-1' },
    ]) {
      expect(editorialPinSourceSchema.safeParse(body).success).toBe(true);
    }
  });
});
