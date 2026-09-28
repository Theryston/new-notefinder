import type { KnipConfig } from 'knip';

// Unused files, exports and dependencies fail CI (`nub run knip`). Before
// adding to an ignore list here, delete the dead code instead.
const config: KnipConfig = {
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
        // Generated shadcn/ui components, used as the design system grows.
        'components/ui/**/*.tsx',
        // Documented entry points (apps/web/CLAUDE.md) for UI that isn't
        // built yet: the auth client and locale-aware navigation.
        'lib/auth/client.ts',
        'lib/i18n/navigation.ts',
      ],
      // Part of the documented stack (apps/web/CLAUDE.md) but not imported
      // yet. Remove each one from this list when it is first used.
      ignoreDependencies: [
        '@hookform/resolvers',
        'lucide-react',
        'react-hook-form',
        'zustand',
      ],
    },
  },
};

export default config;
