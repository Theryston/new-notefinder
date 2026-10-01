import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Plugin } from '@opencode/plugin';

const NUB_VERSION = '0.9.5';

function hasNub(): boolean {
  try {
    execFileSync('nub', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findChromium(): string | undefined {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) {
    return undefined;
  }
  const entries = readdirSync(base)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort();
  const last = entries[entries.length - 1];
  if (!last) {
    return undefined;
  }
  const chrome = join(base, last, 'chrome-linux', 'chrome');
  return existsSync(chrome) ? chrome : undefined;
}

// biome-ignore lint/style/noDefaultExport: OpenCode loads plugins through their default export.
export default Plugin.define({
  id: 'env-setup',
  setup(ctx) {
    const projectDir = ctx.location.project.canonical || ctx.location.directory;
    try {
      if (!hasNub()) {
        execSync(`npm install --global "@nubjs/nub@${NUB_VERSION}"`, {
          cwd: '/tmp',
          stdio: 'ignore',
        });
      }
      execSync('nub install', { cwd: projectDir, stdio: 'ignore' });
    } catch {
      // Never break session startup; run `nub install` manually instead.
    }
    // biome-ignore lint/style/noProcessEnv: Playwright only reads the executable path from the environment.
    if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      const chromium = findChromium();
      if (chromium) {
        // biome-ignore lint/style/noProcessEnv: same as above.
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromium;
      }
    }
  },
});
