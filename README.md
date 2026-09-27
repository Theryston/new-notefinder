# notefinder

Monorepo gerenciado com [Turborepo](https://turborepo.dev) e `nub`.

## Apps

- `apps/web`: frontend [Next.js](https://nextjs.org) com [shadcn/ui](https://ui.shadcn.com) (preset `b48`). Porta 3000.
- `apps/api`: API [NestJS](https://nestjs.com). Porta 3333 (`PORT`).

## Comandos

```sh
nub install          # instala dependências
nub run dev          # sobe web e api
nub run build        # build de tudo
nub run lint
nub run check-types
nub run format
```

Para rodar em um app só: `nub run dev --filter=web` (ou `api`).
