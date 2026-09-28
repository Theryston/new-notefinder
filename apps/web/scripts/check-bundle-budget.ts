import { join } from 'node:path';

import {
  MAX_FIRST_LOAD_KIB,
  measurePages,
  overBudget,
} from './bundle-budget.ts';

// `nub run bundle:check`, after `next build`: prints the first-load JS of every
// prerendered page and fails when one exceeds the budget.
const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;

const reports = measurePages(join(import.meta.dirname, '..', '.next'));
if (reports.length === 0) {
  process.stderr.write('No prerendered pages found: run `next build`.\n');
  process.exit(1);
}
for (const { page, bytes } of reports) {
  process.stdout.write(`${kib(bytes).padStart(12)}  ${page}\n`);
}
const failed = overBudget(reports);
if (failed.length > 0) {
  process.stderr.write(
    `\n${failed.length} page(s) exceed the ${MAX_FIRST_LOAD_KIB} KiB first-load JS budget (scripts/bundle-budget.ts).\n`,
  );
  process.exit(1);
}
process.stdout.write(`\nAll pages within ${MAX_FIRST_LOAD_KIB} KiB.\n`);
