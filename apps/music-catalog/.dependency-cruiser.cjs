// Architecture rules from apps/music-catalog/CLAUDE.md, checked by
// `nub run lint`. They mirror apps/api's: handlers -> services ->
// repositories and integrations, and only repositories touch Drizzle.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports break module boundaries.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'drizzle-only-in-repositories',
      severity: 'error',
      comment:
        'Only repositories talk to the database (Layers in CLAUDE.md). ' +
        'src/database/ owns the client, the schema and the migrator.',
      from: {
        path: '^src/',
        pathNot: ['^src/database/', '[.]repository[.]ts$', '[.]spec[.]ts$'],
      },
      to: { path: ['^src/database/schema/', 'node_modules/drizzle-orm/'] },
    },
    {
      name: 'handlers-call-services',
      severity: 'error',
      comment:
        'WebSocket handlers only decode the payload and call a service: ' +
        'no repositories or integrations.',
      from: { path: '[.]handler[.]ts$' },
      to: { path: ['[.]repository[.]ts$', '^src/integrations/'] },
    },
    {
      name: 'layers-point-down',
      severity: 'error',
      comment:
        'Services and repositories never know the handlers above them, and ' +
        'repositories never call services.',
      from: { path: '[.](service|repository)[.]ts$' },
      to: { path: ['[.]handler[.]ts$', '^src/ws/'] },
    },
    {
      name: 'repositories-do-not-call-services',
      severity: 'error',
      comment: 'Repositories only read and write data.',
      from: { path: '[.]repository[.]ts$' },
      to: { path: '[.]service[.]ts$' },
    },
    {
      name: 'no-database-in-ws-or-integrations',
      severity: 'error',
      comment: 'ws/ and integrations/ are domain-agnostic: no tables.',
      from: { path: '^src/(ws|integrations)/' },
      to: { path: ['^src/database/', 'node_modules/drizzle-orm/'] },
    },
    {
      name: 'ws-does-not-know-modules',
      severity: 'error',
      comment:
        'ws/ is the protocol plumbing; features plug into it, not the reverse.',
      from: { path: '^src/ws/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'integrations-do-not-know-features',
      severity: 'error',
      comment:
        'Integrations wrap third-party services for features, not the reverse.',
      from: { path: '^src/integrations/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'modules-only-through-their-service',
      severity: 'error',
      comment:
        'Other modules use a feature only through its service, never its ' +
        'repository, handler or internals.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '[.]service[.]ts$'],
        // Types are shared contracts, not coupling.
        dependencyTypesNot: ['type-only'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
