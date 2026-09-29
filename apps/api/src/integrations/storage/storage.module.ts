import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { createS3Client, S3StorageService } from './s3-storage.service.js';
import { StorageService } from './storage.service.js';
import { resolveStorageConfig } from './storage-config.js';

@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ENV],
      // Throws while the app boots when the S3 variables are missing.
      useFactory: (env: Env) => {
        const config = resolveStorageConfig(env);
        return new S3StorageService(createS3Client(config), config);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
