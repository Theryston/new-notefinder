import { Injectable } from '@nestjs/common';
import { PersonalHomeRepository } from './home-personal.repository.js';
import { PersonalHomePublicRowsService } from './home-personal-public-rows.service.js';
import { PersonalHomeTasteRowsService } from './home-personal-taste-rows.service.js';

@Injectable()
export class PersonalHomeBuilderDataService {
  constructor(
    readonly repository: PersonalHomeRepository,
    readonly tasteRows: PersonalHomeTasteRowsService,
    readonly publicRows: PersonalHomePublicRowsService,
  ) {}
}
