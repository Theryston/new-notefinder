import { Injectable } from '@nestjs/common';
import type { RecordAcquisitionBody } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { AcquisitionRepository } from './acquisition.repository.js';

/** Account creation window accepted for sign-up attribution. */
const ACQUISITION_ACCOUNT_AGE_MS = 30 * 60 * 1000;

@Injectable()
export class AcquisitionService {
  constructor(private readonly repository: AcquisitionRepository) {}

  async record(userId: string, body: RecordAcquisitionBody): Promise<void> {
    const result = await this.repository.record(
      userId,
      body,
      new Date(Date.now() - ACQUISITION_ACCOUNT_AGE_MS),
    );
    if (result === 'recorded') return;
    if (result === 'missing') {
      throw new AppException('UNAUTHORIZED', 'User no longer exists');
    }
    if (result === 'old') {
      throw new AppException(
        'FORBIDDEN',
        'Account is outside the sign-up window',
      );
    }
    throw new AppException('CONFLICT', 'Acquisition was already recorded');
  }
}
