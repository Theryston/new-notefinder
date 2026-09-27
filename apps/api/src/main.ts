import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { configureApp, createAppLogger } from './setup-app.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule, {
  logger: createAppLogger(env),
});
configureApp(app);
await app.listen(env.PORT);
new Logger('Bootstrap').log(`API listening on port ${env.PORT}`);
