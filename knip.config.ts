import type { KnipConfig } from 'knip';

// Unused files, exports and dependencies fail CI (`nub run knip`). Before
// adding to an ignore list here, delete the dead code instead.
const config: KnipConfig = {
  // Skill files are templates and documentation, not app entry points. The
  // Claude skill paths are symlinks to this same tree.
  ignore: ['.agents/skills/**'],
  workspaces: {
    'apps/api': {
      // drizzle.config.ts parses the app's env when imported, which fails
      // without a .env; the schema it points at is reached through the
      // repositories anyway.
      drizzle: false,
      entry: ['src/main.ts', 'drizzle.config.ts'],
    },
    'apps/web': {
      entry: [
        // Loaded by the framework, not imported: next-intl's type
        // augmentation and its request config (next.config.ts plugin).
        'global.ts',
        'lib/i18n/request.ts',
        // Read by `lhci autorun` (`nub run lighthouse`), not imported.
        'lighthouserc.cjs',
        // Generated shadcn/ui components, used as the design system grows.
        'components/ui/**/*.tsx',
        // Documented entry point (apps/web/CLAUDE.md): locale-aware
        // navigation helpers, not all of them used yet.
        'lib/i18n/navigation.ts',
      ],
      // Part of the documented stack (apps/web/CLAUDE.md) but not imported
      // yet. Remove each one from this list when it is first used.
      ignoreDependencies: ['zustand'],
    },
  },
};

export default config;
