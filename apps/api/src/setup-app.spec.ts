import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { createZodDto } from './common/zod/create-zod-dto.js';
import { createOpenApiDocument } from './setup-app.js';

class CreateThingBody extends createZodDto(
  z.object({
    name: z.string().min(1),
    tags: z.array(z.string()),
    owner: z.object({ email: z.email() }),
  }),
) {}

@Controller('things')
class ThingsController {
  @Post()
  create(@Body() body: CreateThingBody) {
    return body;
  }
}

describe('createOpenApiDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the routes with the Zod JSON Schema of their DTOs', () => {
    const document = createOpenApiDocument(app);

    expect(document.info).toMatchObject({
      title: 'notefinder API',
      version: '1',
    });
    expect(document.paths['/things']?.post).toBeDefined();
    expect(document.components?.schemas?.CreateThingBody).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        tags: { type: 'array', items: { type: 'string' } },
        // Swagger's own derivation drops nested `required`; the Zod JSON
        // Schema keeps it.
        owner: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
          required: ['email'],
        },
      },
      required: ['name', 'tags', 'owner'],
    });
  });
});
