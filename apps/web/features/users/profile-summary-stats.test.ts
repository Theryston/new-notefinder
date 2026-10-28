import { publicProfileSummarySchema } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import {
  PROFILE_SUMMARY_FIELDS,
  PROFILE_SUMMARY_STATS,
} from './profile-summary-stats';

describe('profile summary stats', () => {
  it('maps every displayed stat to a field of the summary contract, in order', () => {
    const fields = Object.keys(publicProfileSummarySchema.shape);

    expect(
      PROFILE_SUMMARY_STATS.map((stat) => PROFILE_SUMMARY_FIELDS[stat]),
    ).toEqual(fields);
  });
});
