# notefinder

Reescrita do [notefinder](https://github.com/theryston/notefinder) com API e
frontend separados. Monorepo gerenciado com [Turborepo](https://turborepo.dev)
e [nub](https://nubjs.com).

## Estrutura

- `apps/web`: frontend [Next.js](https://nextjs.org) com
  [shadcn/ui](https://ui.shadcn.com). Porta 3000.
- `apps/api`: API [NestJS](https://nestjs.com). Porta 3333 (`PORT`).
- `packages/contracts`: schemas Zod e tipos compartilhados entre API, web e
  (futuramente) mobile.

Padrões de código, arquitetura e ferramentas estão em `CLAUDE.md` (raiz) e em
`apps/*/CLAUDE.md`.

## Comandos

```sh
nub install          # instala dependências (e os git hooks do lefthook)
nub run infra:up     # sobe Postgres + Redis via docker compose
nub run dev          # sobe web e api
nub run build        # build de tudo
nub run lint         # Biome (lint + format + imports)
nub run format       # Biome com --write
nub run check-types
nub run test
```

Para rodar em um app só: `nub run dev --filter=web` (ou `api`).

Copie `apps/api/.env.example` e `apps/web/.env.example` para `.env` em cada app.
