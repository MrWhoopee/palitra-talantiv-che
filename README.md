# Палітра талантів

Сайт для запису на заняття музичної студії в Черкасах (вокал, фортепіано,
гітара, укулеле). Turborepo-монорепозиторій: Next.js фронтенд, Express API
на Prisma/PostgreSQL і спільні пакети з типами та валідацією.

## Передумови

- Node.js **>= 22.12**
- pnpm **11.21.0** (`packageManager` у `package.json` — увімкніть через
  Corepack: `corepack enable`)
- Docker (для PostgreSQL і Mailpit)

## Налаштування

Виконувати саме в цьому порядку — інакше `pnpm dev` чи `pnpm typecheck`
впадуть з незрозумілою помилкою.

1. Встановити залежності:

   ```sh
   pnpm install
   ```

2. Скопіювати файли оточення (жоден `.env` не лежить у репозиторії):

   ```sh
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Підняти PostgreSQL і Mailpit у Docker:

   ```sh
   pnpm db:up
   ```

4. Згенерувати Prisma Client (каталог `apps/api/src/generated/` не
   комітиться в git — без цього кроку `pnpm typecheck` не пройде):

   ```sh
   pnpm --filter @palitra/api db:generate
   ```

5. Накотити міграції на базу:

   ```sh
   pnpm --filter @palitra/api db:deploy
   ```

## Запуск

Підняти веб і API одночасно (Turborepo запускає обидва `dev`-скрипти):

```sh
pnpm dev
```

Інші корисні команди з кореня репозиторію:

```sh
pnpm build         # зібрати всі застосунки й пакети
pnpm lint           # ESLint по всьому монорепозиторію
pnpm typecheck       # tsc --noEmit по всіх пакетах
pnpm test           # усі тести (vitest)
pnpm format:check    # перевірка форматування Prettier
pnpm db:down         # зупинити Docker-контейнери
```

## Порти

| Сервіс         | Порт |
| -------------- | ---- |
| Web (Next.js)  | 3000 |
| API (Express)  | 4000 |
| PostgreSQL     | 5433 |
| Mailpit (UI)   | 8025 |
| Mailpit (SMTP) | 1025 |

**Чому PostgreSQL на 5433, а не 5432**: це навмисний вибір. Порт 5432 часто
вже зайнятий локальним сервісом PostgreSQL на машині розробника — 5433
дозволяє контейнеру співіснувати з ним без конфліктів. Не повертайте цей
порт назад на 5432.
