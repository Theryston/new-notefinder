import { Module } from '@nestjs/common';
import { PracticePreferencesController } from './practice-preferences.controller.js';
import { PracticePreferencesRepository } from './practice-preferences.repository.js';
import { PracticePreferencesService } from './practice-preferences.service.js';

/** The practice preferences that follow the signed-in User across devices. */
@Module({
  controllers: [PracticePreferencesController],
  providers: [PracticePreferencesService, PracticePreferencesRepository],
})
export class PracticePreferencesModule {}
