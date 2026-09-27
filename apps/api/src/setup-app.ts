import {
  ConsoleLogger,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { cleanupOpenApiDoc } from './common/zod/cleanup-open-api-doc.js';
import { ZodSerializerInterceptor } from './common/zod/zod-serializer.interceptor.js';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { ENV, type Env } from './config/env.js';

export const createAppLogger = (env: Env): ConsoleLogger =>
  new ConsoleLogger({ json: env.NODE_ENV === 'production' });

/**
 * Global HTTP setup shared by `main.ts` and the e2e tests, so tests exercise
 * the exact same versioning, CORS, validation, serialization and errors.
 */
export const configureApp = (app: INestApplication): void => {
  const env = app.get<Env>(ENV);

  // Lets `req.ip` (the rate-limit key) be the real client behind the
  // CDN/reverse proxy, trusting X-Forwarded-For only from configured hops.
  const expressApp: Express = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', env.TRUST_PROXY);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: env.WEB_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('notefinder API')
      .setVersion('1')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
  }
};
