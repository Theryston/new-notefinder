// Architecture rules from apps/api/CLAUDE.md, checked by `nub run lint`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports break Nest DI order and module boundaries.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'drizzle-only-in-repositories',
      severity: 'error',
      comment:
        'Only repositories talk to the database (Layers in CLAUDE.md). ' +
        'auth.ts is the exception: Better Auth takes the Drizzle adapter.',
      from: {
        path: '^src/modules/',
        pathNot: [
          '[.]repository[.]ts$',
          '[.]spec[.]ts$',
          '^src/modules/auth/auth[.]ts$',
        ],
      },
      to: { path: ['^src/database/schema/', 'node_modules/drizzle-orm/'] },
    },
    {
      name: 'controllers-call-services',
      severity: 'error',
      comment: 'Controllers are HTTP only and call one service method.',
      from: { path: '[.]controller[.]ts$' },
      to: { path: '[.]repository[.]ts$' },
    },
    {
      name: 'no-database-in-common-or-integrations',
      severity: 'error',
      comment: 'common/ and integrations/ are domain-agnostic: no tables.',
      from: { path: '^src/(common|integrations|redis|queue)/' },
      to: { path: ['^src/database/schema/', 'node_modules/drizzle-orm/'] },
    },
    {
      name: 'modules-only-through-their-service',
      severity: 'error',
      comment:
        'Other modules use a feature only through its exported service ' +
        '(and its Nest module to import it), never its repository, ' +
        'controller or internals.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '[.](service|module)[.]ts$'],
        // Types (e.g. `AuthUser`) are shared contracts, not coupling.
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'common-is-domain-agnostic',
      severity: 'error',
      comment: 'common/ holds framework-level code only.',
      from: { path: '^src/common/' },
      // The session types (`AuthUser`) are the one domain shape common/ may
      // name, as types only.
      to: {
        path: '^src/(modules|integrations)/',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'integrations-do-not-know-features',
      severity: 'error',
      comment:
        'Integrations wrap third-party services for features, not the reverse.',
      from: { path: '^src/integrations/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
