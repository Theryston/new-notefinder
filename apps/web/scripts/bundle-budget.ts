import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Most JavaScript (gzipped) a prerendered page may make the browser download
 * on its first load. Raising it is a deliberate decision: say in the PR what
 * grew and why it couldn't be lazy-loaded (apps/web/CLAUDE.md, "speed").
 */
export const MAX_FIRST_LOAD_KIB = 250;

export type PageReport = { page: string; scripts: string[]; bytes: number };

/**
 * `src` of every script a browser runs on the first load of the page.
 * `nomodule` scripts (polyfills) only load in legacy browsers, so they don't
 * count.
 */
export function firstLoadScripts(html: string): string[] {
  const scripts = new Set<string>();
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = /\ssrc="([^"]+)"/i.exec(tag)?.[1];
    if (src && !/\snomodule\b/i.test(tag)) scripts.add(src);
  }
  return [...scripts];
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** First-load JS of every page prerendered by `next build` in `nextDir`. */
export function measurePages(nextDir: string): PageReport[] {
  const appDir = join(nextDir, 'server', 'app');
  const gzipped = new Map<string, number>();
  const sizeOf = (src: string) => {
    let size = gzipped.get(src);
    if (size === undefined) {
      const file = join(nextDir, src.replace(/^\/_next\//, ''));
      size = gzipSync(readFileSync(file)).byteLength;
      gzipped.set(src, size);
    }
    return size;
  };

  return htmlFiles(appDir).map((file) => {
    const scripts = firstLoadScripts(readFileSync(file, 'utf8')).filter((src) =>
      src.startsWith('/_next/static/'),
    );
    return {
      page: relative(appDir, file),
      scripts,
      bytes: scripts.reduce((total, src) => total + sizeOf(src), 0),
    };
  });
}

export function overBudget(
  reports: readonly PageReport[],
  maxKib = MAX_FIRST_LOAD_KIB,
): PageReport[] {
  return reports.filter((report) => report.bytes > maxKib * 1024);
}
