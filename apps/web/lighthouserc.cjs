// Lighthouse CI (`nub run lighthouse`, after `nub run build`): audits the
// production build of every page below and fails on the assertions.
const port = 3100;

module.exports = {
  ci: {
    collect: {
      // Same dummy env as e2e/web-server-env.ts: the server refuses to boot
      // without it, and no page talks to the API yet.
      startServerCommand: `API_URL=http://127.0.0.1:3333 NEXT_PUBLIC_API_URL=http://127.0.0.1:3333 REVALIDATE_SECRET=lighthouse-revalidate-secret-unused next start --port ${port}`,
      startServerReadyPattern: 'Ready',
      url: [
        `http://localhost:${port}/en`,
        `http://localhost:${port}/pt-BR`,
        `http://localhost:${port}/en/forgot-password`,
        `http://localhost:${port}/pt-BR/forgot-password`,
        `http://localhost:${port}/en/sign-up`,
        `http://localhost:${port}/pt-BR/sign-up`,
        `http://localhost:${port}/en/sign-in`,
        `http://localhost:${port}/pt-BR/sign-in`,
        `http://localhost:${port}/en/terms`,
        `http://localhost:${port}/pt-BR/terms`,
      ],
      // The median of 3 runs smooths out noise on shared CI runners.
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      // Each page's median run must meet these (desktop preset).
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        // Skeletons match the final content (apps/web/CLAUDE.md), so there is
        // no layout shift to allow for beyond rounding.
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.01 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
