import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  firstLoadScripts,
  MAX_FIRST_LOAD_KIB,
  measurePages,
  overBudget,
} from './bundle-budget';

describe('firstLoadScripts', () => {
  it('lists each script src once, skipping nomodule polyfills', () => {
    const html = [
      '<link rel="preload" as="script" href="/_next/static/chunks/a.js"/>',
      '<script src="/_next/static/chunks/a.js" async="">',
      '<script src="/_next/static/chunks/b.js" async="">',
      '<script src="/_next/static/chunks/polyfill.js" noModule="">',
      '<script src="/_next/static/chunks/a.js" id="_R_" async="">',
      '<script>self.__next_f.push([1,"inline"])</script>',
    ].join('');

    expect(firstLoadScripts(html)).toEqual([
      '/_next/static/chunks/a.js',
      '/_next/static/chunks/b.js',
    ]);
  });
});

describe('measurePages', () => {
  let nextDir: string;

  afterEach(() => {
    rmSync(nextDir, { recursive: true, force: true });
  });

  it('sums the gzipped size of each prerendered page scripts', () => {
    nextDir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    mkdirSync(join(nextDir, 'static', 'chunks'), { recursive: true });
    mkdirSync(join(nextDir, 'server', 'app', 'nested'), { recursive: true });
    const shared = 'shared();'.repeat(100);
    const extra = 'extra();'.repeat(50);
    writeFileSync(join(nextDir, 'static', 'chunks', 'shared.js'), shared);
    writeFileSync(join(nextDir, 'static', 'chunks', 'extra.js'), extra);
    writeFileSync(
      join(nextDir, 'server', 'app', 'home.html'),
      '<script src="/_next/static/chunks/shared.js" async="">',
    );
    writeFileSync(
      join(nextDir, 'server', 'app', 'nested', 'page.html'),
      '<script src="/_next/static/chunks/shared.js" async="">' +
        '<script src="/_next/static/chunks/extra.js" async="">' +
        '<script src="https://cdn.example.com/other.js" async="">',
    );

    const reports = measurePages(nextDir);
    const sharedSize = gzipSync(shared).byteLength;
    const extraSize = gzipSync(extra).byteLength;

    expect(reports).toHaveLength(2);
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ page: 'home.html', bytes: sharedSize }),
        expect.objectContaining({
          page: join('nested', 'page.html'),
          bytes: sharedSize + extraSize,
        }),
      ]),
    );
  });
});

describe('overBudget', () => {
  it('returns only the pages above the budget', () => {
    const limit = MAX_FIRST_LOAD_KIB * 1024;
    const within = { page: 'a.html', scripts: [], bytes: limit };
    const over = { page: 'b.html', scripts: [], bytes: limit + 1 };

    expect(overBudget([within, over])).toEqual([over]);
  });
});
