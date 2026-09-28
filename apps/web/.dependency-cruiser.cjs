// Architecture rules from apps/web/CLAUDE.md, checked by `nub run lint`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports (including between features) are not allowed.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'routes-are-leaves',
      severity: 'error',
      comment:
        'app/ only composes: nothing outside it imports a route, layout or ' +
        'route handler.',
      from: { pathNot: '^app/' },
      to: { path: '^app/' },
    },
    {
      name: 'shared-code-is-domain-agnostic',
      severity: 'error',
      comment:
        'components/, hooks/ and lib/ are generic and never depend on a ' +
        'feature.',
      from: { path: '^(components|hooks|lib)/' },
      to: { path: '^features/' },
    },
    {
      name: 'lib-is-the-bottom-layer',
      severity: 'error',
      comment: 'lib/ (API client, env, i18n, utils) does not import UI.',
      from: { path: '^lib/' },
      to: { path: '^(components|hooks)/' },
    },
    {
      name: 'features-only-through-components',
      severity: 'error',
      comment:
        "A feature may use other features' public components, never their " +
        'queries, actions, hooks or stores.',
      from: { path: '^features/([^/]+)/' },
      to: {
        path: '^features/[^/]+/',
        pathNot: ['^features/$1/', '^features/[^/]+/components/'],
      },
    },
    {
      name: 'cache-handlers-no-aliases',
      severity: 'error',
      comment:
        'Next loads cache-handlers/ natively, outside the bundle: `@/` ' +
        'aliases do not resolve there, use relative `.ts` imports.',
      from: { path: '^cache-handlers/' },
      to: { dependencyTypes: ['aliased'] },
    },
    {
      name: 'cache-handlers-stay-out-of-the-app',
      severity: 'error',
      comment:
        'cache-handlers/ runs outside the bundle: no UI, routes or ' +
        '`server-only`.',
      from: { path: '^cache-handlers/' },
      to: {
        path: [
          '^(app|components|features|hooks)/',
          'node_modules/server-only/',
        ],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '^(\\.next|coverage|playwright-report|test-results|public)/',
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
