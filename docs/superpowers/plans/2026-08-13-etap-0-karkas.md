# Етап 0: каркас монорепо — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Підняти каркас монорепо, у якому `pnpm dev` стартує обидва застосунки, `/health` відповідає з реальною перевіркою БД, а CI проганяє лінт, типи й тести.

**Architecture:** Turborepo з pnpm workspaces. Два застосунки (`apps/web` на Next.js, `apps/api` на Express) і три внутрішні пакети (`packages/config`, `packages/shared`, `packages/api-client`). Внутрішні пакети віддають TypeScript-джерела без збірки — споживачі транспілюють їх самі, що прибирає крок build із циклу розробки. Postgres і поштовий перехоплювач піднімаються через Docker Compose.

**Tech Stack:** pnpm 11.21, Turborepo 2.10, TypeScript 5.9, Next.js 16.3, React 19.2, Express 5.2, Prisma 7.9, Zod 4.4, Vitest 4.1, ESLint 10, Prettier 3.9

**Spec:** `docs/superpowers/specs/2026-08-13-palitra-talantiv-design.md`

## Global Constraints

- **Node.js** — `>=22.12`. Локально стоїть v22.19.0. Prisma 7 вимагає `^20.19 || ^22.12 || >=24.0`.
- **Package manager** — pnpm `11.21.0`, закріплений полем `packageManager` у кореневому `package.json`.
- **TypeScript — рівно `5.9.3`.** Не `7.x`, хоч саме він зараз `latest` в npm. Причина: `typescript-eslint@8.67.0` оголошує peer `typescript >=4.8.4 <6.1.0`, і релізу з підтримкою TS 7 ще немає. З TS 7 типізований лінт тихо перестане працювати. Переглянути, коли typescript-eslint випустить підтримку.
- **Часовий пояс** — уся робота з часом веде до `Europe/Kyiv`; у БД зберігається UTC.
- **Іменування пакетів** — скоуп `@palitra/*`.
- **Мова коду** — англійська: імена, коментарі, повідомлення комітів технічної частини. Українська — тільки в текстах інтерфейсу й документації.
- **Шрифти** — підключати підмножини `latin`, `cyrillic` **і `cyrillic-ext`**. Символ гривні ₴ (U+20B4) лежить саме в `cyrillic-ext`; без нього ціни рендеряться прямокутником.
- **Кольорові обмеження зі спеки** — помаранчевий і зелений не використовуються як колір тексту (2.3:1 і 1.8:1 на кремовому). Помаранчевий допустимий лише як заливка під темним текстом.

## Передумови

Перевірено в цьому середовищі:

| Інструмент | Версія | Стан |
|---|---|---|
| Node.js | v22.19.0 | ок |
| pnpm | 11.21.0 | ок |
| Docker CLI | 29.2.1 | ок |
| Docker Compose | v5.0.2 | ок |
| Docker daemon | — | **не запущений**, треба стартувати Docker Desktop перед Task 5 |
| git | 2.51.0 | ок |

## Структура файлів

```
palitra-talantiv-che/
├─ .github/workflows/ci.yml        CI: лінт, типи, тести
├─ .gitattributes                  нормалізація кінців рядків
├─ .gitignore
├─ .npmrc                          строгість pnpm
├─ package.json                    корінь workspace, спільні скрипти
├─ pnpm-workspace.yaml
├─ turbo.json                      граф задач
├─ docker-compose.yml              postgres + mailpit
├─ .env.example
├─ packages/
│  ├─ config/                      tsconfig / eslint / prettier — без коду
│  ├─ shared/                      домен: коди помилок, zod-схеми
│  └─ api-client/                  типізований клієнт до API
└─ apps/
   ├─ api/                         Express, Prisma, health
   └─ web/                         Next.js, дизайн-токени
```

Відповідальність кожного файлу описана в задачі, яка його створює.

## Що свідомо не входить в етап 0

- **Production-збірка API.** У розробці API запускається через `tsx`, який розуміє TypeScript-джерела внутрішніх пакетів. Для продакшена знадобиться бандлер (`tsup` або аналог), бо `tsc` не збирає джерела workspace-залежностей у самодостатній вихід. Це вирішується на етапі 8 разом із Dockerfile.
- Будь-які доменні моделі. Prisma-схема на цьому етапі не містить жодної моделі — тільки міграція, що вмикає розширення `btree_gist`, потрібне для exclusion constraint на етапі 3.
- Автентифікація, будь-який UI понад сторінку статусу.

---

### Task 1: Корінь монорепо

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.gitattributes`

**Interfaces:**
- Consumes: нічого
- Produces: workspace-скоуп `@palitra/*`; кореневі скрипти `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; turbo-задачі `dev`, `lint`, `typecheck`, `test`, `build`

- [ ] **Step 1: Створити `.gitattributes`**

Це першим кроком навмисно. Репозиторій уже видав попередження `LF will be replaced by CRLF` — без нормалізації частина файлів потрапить у git із CRLF, і кожен, хто працюватиме не на Windows, побачить фальшиві діфи на весь файл.

```gitattributes
* text=auto eol=lf

*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.avif binary
*.ico binary
*.woff binary
*.woff2 binary
*.pdf binary

pnpm-lock.yaml -diff linguist-generated
```

- [ ] **Step 2: Створити `.gitignore`**

```gitignore
node_modules/
.pnpm-store/

.next/
out/
dist/
build/
*.tsbuildinfo

.turbo/

.env
.env.local
.env.*.local

apps/api/src/generated/

coverage/
.vitest/

.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
```

- [ ] **Step 3: Створити `.npmrc`**

```ini
engine-strict=true
```

`engine-strict` змушує pnpm впасти на невідповідній версії Node замість того, щоб зібратись і зламатись пізніше в незрозумілому місці.

- [ ] **Step 4: Створити `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Створити кореневий `package.json`**

```json
{
  "name": "palitra-talantiv-che",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.21.0",
  "engines": {
    "node": ">=22.12"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  },
  "devDependencies": {
    "prettier": "3.9.6",
    "turbo": "2.10.9",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 6: Створити `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "outputs": []
    },
    "test": {
      "outputs": []
    }
  }
}
```

У Turborepo 2.x ключ називається `tasks`, а не `pipeline` — старе ім'я прибрали в 2.0.

- [ ] **Step 7: Встановити залежності й перевірити, що workspace піднявся**

```bash
pnpm install
```

Очікується: успіх, створюється `pnpm-lock.yaml`, попереджень про несумісний Node немає.

- [ ] **Step 8: Перевірити, що turbo працює**

```bash
pnpm exec turbo --version
```

Очікується: `2.10.9`

- [ ] **Step 9: Коміт**

```bash
git add .gitattributes .gitignore .npmrc package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace and turborepo"
```

---

### Task 2: Спільна конфігурація — `packages/config`

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/tsconfig.node.json`
- Create: `packages/config/tsconfig.react.json`
- Create: `packages/config/eslint.config.js`
- Create: `packages/config/prettier.config.js`
- Create: `prettier.config.js` (корінь)
- Create: `eslint.config.js` (корінь)
- Create: `.prettierignore` (корінь)
- Modify: `package.json` (корінь) — додати `@palitra/config` і `eslint` у devDependencies

**Interfaces:**
- Consumes: workspace із Task 1
- Produces: пакет `@palitra/config` з експортами `./tsconfig.base.json`, `./tsconfig.node.json`, `./tsconfig.react.json`, `./eslint`, `./prettier`

- [ ] **Step 1: Створити `packages/config/package.json`**

```json
{
  "name": "@palitra/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.node.json": "./tsconfig.node.json",
    "./tsconfig.react.json": "./tsconfig.react.json",
    "./eslint": "./eslint.config.js",
    "./prettier": "./prettier.config.js"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.8.1",
    "eslint-config-prettier": "10.1.8",
    "typescript": "5.9.3",
    "typescript-eslint": "8.67.0"
  }
}
```

`@eslint/js` версіонується окремо від `eslint` — це не одна й та сама цифра.

- [ ] **Step 2: Створити `packages/config/tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,

    "noEmit": true,
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess` і `exactOptionalPropertyTypes` увімкнені навмисно. Вони роблять типи неприємнішими, але саме вони ловлять клас помилок «звернувся до елемента масиву, якого немає» — а вся календарна логіка етапу 2 будується на індексації масивів слотів.

- [ ] **Step 3: Створити `packages/config/tsconfig.node.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Створити `packages/config/tsconfig.react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "allowJs": true,
    "incremental": true
  }
}
```

- [ ] **Step 5: Створити `packages/config/prettier.config.js`**

```js
/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  endOfLine: 'lf',
};
```

`endOfLine: 'lf'` дублює `.gitattributes` на рівні форматера — інакше Prettier на Windows перепише файли назад у CRLF.

- [ ] **Step 6: Створити `packages/config/eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  prettier,
);
```

`eslint-config-prettier` іде останнім — він вимикає правила ESLint, які конфліктують із форматером. Якщо поставити його раніше, наступні конфіги ввімкнуть їх назад.

- [ ] **Step 7: Створити кореневий `prettier.config.js`**

```js
export { default } from '@palitra/config/prettier';
```

- [ ] **Step 8: Створити кореневий `eslint.config.js`**

```js
export { default } from '@palitra/config/eslint';
```

- [ ] **Step 8a: Створити кореневий `.prettierignore`**

```gitignore
pnpm-lock.yaml
.next/
.turbo/
dist/
coverage/
apps/api/src/generated/
apps/api/prisma/migrations/
```

Без цього файлу `pnpm format:check` у CI впаде: Prettier спробує відформатувати згенерований Prisma-клієнт і `pnpm-lock.yaml`. Міграції виключені окремо — Prettier переформатовує SQL, а міграції після застосування редагувати не можна, інакше Prisma вважатиме їх зміненими.

- [ ] **Step 9: Додати `@palitra/config` у кореневі devDependencies**

У кореневому `package.json` додати в `devDependencies`:

```json
"@palitra/config": "workspace:*",
"eslint": "10.8.1"
```

**Правило для всіх наступних задач.** Кожен пакет зі скриптом `lint` мусить (а) мати `eslint` у власних `devDependencies` і (б) містити власний `eslint.config.js` з одним рядком:

```js
export { default } from '@palitra/config/eslint';
```

Причина в pnpm: він лінкує в `node_modules` пакета лише те, що цей пакет оголосив. Без власної залежності `eslint` скрипт впаде з «command not found», навіть якщо eslint стоїть у корені. Власний конфіг-файл потрібен, щоб не покладатись на пошук конфігу вгору по дереву каталогів.

- [ ] **Step 10: Встановити й перевірити лінт**

```bash
pnpm install
pnpm exec eslint . --max-warnings=0
```

Очікується: завершується без помилок (файлів для перевірки поки майже немає — важливо, що конфіг завантажився без падіння).

- [ ] **Step 11: Перевірити форматер**

```bash
pnpm format:check
```

Очікується: `All matched files use Prettier code style!` Якщо ні — виконати `pnpm format` і перевірити ще раз.

- [ ] **Step 12: Коміт**

```bash
git add packages/config eslint.config.js prettier.config.js .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: add shared tsconfig, eslint and prettier config package"
```

---

### Task 3: Домен — `packages/shared`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/eslint.config.js`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/errors.test.ts`
- Create: `packages/shared/src/health.ts`
- Create: `packages/shared/src/health.test.ts`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `@palitra/config`
- Produces: пакет `@palitra/shared`, експортує:
  - `DOMAIN_ERROR_CODES` — readonly-масив кодів
  - `type DomainErrorCode` — юніон із цього масиву
  - `DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number>` — мапа код → HTTP-статус
  - `apiErrorSchema` — zod-схема тіла помилки, `type ApiError`
  - `healthResponseSchema` — zod-схема відповіді `/health`, `type HealthResponse`

- [ ] **Step 1: Створити `packages/shared/package.json`**

```json
{
  "name": "@palitra/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@palitra/config": "workspace:*",
    "eslint": "10.8.1",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

Пакет віддає `./src/index.ts` напряму — без кроку збірки. Споживачі (`tsx` в API, `transpilePackages` у Next) транспілюють джерела самі.

- [ ] **Step 1a: Створити `packages/shared/eslint.config.js`**

```js
export { default } from '@palitra/config/eslint';
```

- [ ] **Step 2: Створити `packages/shared/tsconfig.json`**

```json
{
  "extends": "@palitra/config/tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Створити `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Написати падаючий тест на коди помилок**

Створити `packages/shared/src/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, DOMAIN_ERROR_STATUS, apiErrorSchema } from './errors.js';

describe('domain error codes', () => {
  it('maps every code to an http error status', () => {
    for (const code of DOMAIN_ERROR_CODES) {
      expect(DOMAIN_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(DOMAIN_ERROR_STATUS[code]).toBeLessThan(600);
    }
  });

  it('treats every code except INTERNAL_ERROR as a client error', () => {
    const serverErrorCodes = DOMAIN_ERROR_CODES.filter((code) => DOMAIN_ERROR_STATUS[code] >= 500);
    expect(serverErrorCodes).toEqual(['INTERNAL_ERROR']);
  });

  it('has no duplicate codes', () => {
    expect(new Set(DOMAIN_ERROR_CODES).size).toBe(DOMAIN_ERROR_CODES.length);
  });

  it('reports a taken slot as a conflict', () => {
    expect(DOMAIN_ERROR_STATUS.SLOT_TAKEN).toBe(409);
  });
});

describe('apiErrorSchema', () => {
  it('accepts a minimal error body', () => {
    const parsed = apiErrorSchema.parse({ code: 'SLOT_TAKEN', message: 'Слот щойно зайняли' });
    expect(parsed.code).toBe('SLOT_TAKEN');
    expect(parsed.details).toBeUndefined();
  });

  it('rejects an unknown code', () => {
    expect(() => apiErrorSchema.parse({ code: 'NOPE', message: 'x' })).toThrow();
  });
});
```

- [ ] **Step 5: Запустити тест і переконатися, що він падає**

```bash
pnpm --filter @palitra/shared test
```

Очікується: FAIL — `Failed to resolve import "./errors.js"`

- [ ] **Step 6: Реалізувати `packages/shared/src/errors.ts`**

```ts
import { z } from 'zod';

export const DOMAIN_ERROR_CODES = [
  'SLOT_TAKEN',
  'TRIAL_ALREADY_USED',
  'TOO_LATE_TO_CANCEL',
  'SUBSCRIPTION_EXHAUSTED',
  'GROUP_FULL',
  'OUTSIDE_BOOKING_HORIZON',
  'NOT_TEACHER_OWNED',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number> = {
  SLOT_TAKEN: 409,
  TRIAL_ALREADY_USED: 409,
  TOO_LATE_TO_CANCEL: 422,
  SUBSCRIPTION_EXHAUSTED: 409,
  GROUP_FULL: 409,
  OUTSIDE_BOOKING_HORIZON: 422,
  NOT_TEACHER_OWNED: 403,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
};

export const apiErrorSchema = z.object({
  code: z.enum(DOMAIN_ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
```

- [ ] **Step 7: Запустити тест і переконатися, що він проходить**

```bash
pnpm --filter @palitra/shared test
```

Очікується: PASS, 6 тестів.

- [ ] **Step 8: Написати падаючий тест на схему health**

Створити `packages/shared/src/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      uptimeSeconds: 12.5,
      database: 'up',
    });
    expect(parsed.database).toBe('up');
  });

  it('accepts a response with the database down', () => {
    const parsed = healthResponseSchema.parse({
      status: 'degraded',
      uptimeSeconds: 0,
      database: 'down',
    });
    expect(parsed.status).toBe('degraded');
  });

  it('rejects a negative uptime', () => {
    expect(() =>
      healthResponseSchema.parse({ status: 'ok', uptimeSeconds: -1, database: 'up' }),
    ).toThrow();
  });

  it('rejects an unknown database state', () => {
    expect(() =>
      healthResponseSchema.parse({ status: 'ok', uptimeSeconds: 1, database: 'maybe' }),
    ).toThrow();
  });
});
```

- [ ] **Step 9: Запустити тест і переконатися, що він падає**

```bash
pnpm --filter @palitra/shared test
```

Очікується: FAIL — `Failed to resolve import "./health.js"`

- [ ] **Step 10: Реалізувати `packages/shared/src/health.ts`**

```ts
import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number().nonnegative(),
  database: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

- [ ] **Step 11: Створити `packages/shared/src/index.ts`**

```ts
export * from './errors.js';
export * from './health.js';
```

- [ ] **Step 12: Запустити тести, лінт і типи**

```bash
pnpm --filter @palitra/shared test
pnpm --filter @palitra/shared lint
pnpm --filter @palitra/shared typecheck
```

Очікується: PASS 10 тестів (6 на коди помилок, 4 на схему health), лінт і typecheck без помилок.

- [ ] **Step 13: Коміт**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add domain error codes and health response schema"
```

---

### Task 4: Каркас API — Express 5 і `/health`

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/eslint.config.js`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/lib/env.ts`
- Create: `apps/api/src/http/error-handler.ts`
- Create: `apps/api/src/http/app.ts`
- Create: `apps/api/src/modules/health/health.service.ts`
- Create: `apps/api/src/modules/health/health.router.ts`
- Create: `apps/api/src/modules/health/health.router.test.ts`
- Create: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: `@palitra/shared` — `healthResponseSchema`, `DOMAIN_ERROR_STATUS`, `type DomainErrorCode`
- Produces:
  - `createApp(deps: { checkDatabase: () => Promise<boolean> }): Express` — фабрика застосунку
  - `class DomainError extends Error` з полями `code: DomainErrorCode`, `details?: unknown`
  - `env` — провалідований об'єкт змінних оточення з полями `NODE_ENV`, `PORT`, `DATABASE_URL`, `WEB_ORIGIN`

- [ ] **Step 1: Створити `apps/api/package.json`**

```json
{
  "name": "@palitra/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@palitra/shared": "workspace:*",
    "cors": "2.8.6",
    "express": "5.2.1",
    "helmet": "8.3.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@palitra/config": "workspace:*",
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/node": "22.20.1",
    "@types/supertest": "7.2.1",
    "eslint": "10.8.1",
    "supertest": "7.2.2",
    "tsx": "4.23.12",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 1a: Створити `apps/api/eslint.config.js`**

```js
export { default } from '@palitra/config/eslint';
```

- [ ] **Step 2: Створити `apps/api/tsconfig.json`**

```json
{
  "extends": "@palitra/config/tsconfig.node.json",
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Створити `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Створити `apps/api/src/lib/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
```

Валідація оточення на старті — щоб застосунок падав одразу з внятним повідомленням, а не через годину на першому запиті до БД із `undefined` у рядку з'єднання.

- [ ] **Step 5: Створити `apps/api/src/http/error-handler.ts`**

```ts
import { DOMAIN_ERROR_STATUS, type ApiError, type DomainErrorCode } from '@palitra/shared';
import type { ErrorRequestHandler } from 'express';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    const body: ApiError = { code: err.code, message: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(DOMAIN_ERROR_STATUS[err.code]).json(body);
    return;
  }

  console.error('Unhandled error', err);

  const body: ApiError = { code: 'INTERNAL_ERROR', message: 'Unexpected server error' };
  res.status(DOMAIN_ERROR_STATUS.INTERNAL_ERROR).json(body);
};
```

Несподівана помилка логується повністю, але назовні йде тільки нейтральне повідомлення: текст винятку може містити рядок з'єднання або SQL, а `errorHandler` віддає відповідь у тому числі неавторизованим.

- [ ] **Step 6: Написати падаючий тест на `/health`**

Створити `apps/api/src/modules/health/health.router.test.ts`:

```ts
import { healthResponseSchema } from '@palitra/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../http/app.js';

describe('GET /health', () => {
  it('reports ok when the database is reachable', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded with status 503 when the database is unreachable', async () => {
    const app = createApp({ checkDatabase: async () => false });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('down');
  });

  it('reports degraded when the database check throws', async () => {
    const app = createApp({
      checkDatabase: async () => {
        throw new Error('connection refused');
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.database).toBe('down');
  });

  it('returns a NOT_FOUND error body for unknown routes', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
```

Перевірка бази передається як залежність, а не імпортується. Завдяки цьому тест не потребує ані Postgres, ані моків — три сценарії описуються трьома рядками.

- [ ] **Step 7: Запустити тест і переконатися, що він падає**

```bash
pnpm --filter @palitra/api test
```

Очікується: FAIL — `Failed to resolve import "../../http/app.js"`

- [ ] **Step 8: Реалізувати `apps/api/src/modules/health/health.service.ts`**

```ts
import type { HealthResponse } from '@palitra/shared';

export async function buildHealthReport(
  checkDatabase: () => Promise<boolean>,
  uptimeSeconds: number,
): Promise<HealthResponse> {
  let database: HealthResponse['database'] = 'down';
  try {
    database = (await checkDatabase()) ? 'up' : 'down';
  } catch {
    database = 'down';
  }

  return {
    status: database === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.max(0, Math.round(uptimeSeconds * 1000) / 1000),
    database,
  };
}
```

- [ ] **Step 9: Реалізувати `apps/api/src/modules/health/health.router.ts`**

```ts
import { Router } from 'express';
import { buildHealthReport } from './health.service.js';

export function createHealthRouter(checkDatabase: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const report = await buildHealthReport(checkDatabase, process.uptime());
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  });

  return router;
}
```

- [ ] **Step 10: Реалізувати `apps/api/src/http/app.ts`**

```ts
import type { ApiError } from '@palitra/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createHealthRouter } from '../modules/health/health.router.js';
import { errorHandler } from './error-handler.js';

export interface AppDeps {
  checkDatabase: () => Promise<boolean>;
  webOrigin?: string;
}

export function createApp({ checkDatabase, webOrigin }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin ?? 'http://localhost:3000', credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter(checkDatabase));

  app.use((_req, res) => {
    const body: ApiError = { code: 'NOT_FOUND', message: 'Route not found' };
    res.status(404).json(body);
  });

  app.use(errorHandler);

  return app;
}
```

Express 5 сам перехоплює помилки з async-обробників і передає їх у `errorHandler` — обгортки на кшталт `asyncHandler`, обов'язкової в Express 4, більше не потрібно.

- [ ] **Step 11: Запустити тести й переконатися, що вони проходять**

```bash
pnpm --filter @palitra/api test
```

Очікується: PASS, 4 тести.

- [ ] **Step 12: Створити `apps/api/src/server.ts`**

```ts
import { loadEnv } from './lib/env.js';
import { createApp } from './http/app.js';

const env = loadEnv();

const app = createApp({
  checkDatabase: async () => true,
  webOrigin: env.WEB_ORIGIN,
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
```

`checkDatabase` тимчасово повертає `true` — справжня перевірка підключається в Task 6, коли з'явиться Prisma.

- [ ] **Step 13: Перевірити лінт і типи**

```bash
pnpm --filter @palitra/api lint
pnpm --filter @palitra/api typecheck
```

Очікується: без помилок.

- [ ] **Step 14: Коміт**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add express app skeleton with health endpoint"
```

---

### Task 5: Docker Compose — Postgres і перехоплювач пошти

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `apps/api/.env.example`

**Interfaces:**
- Consumes: нічого з попередніх задач
- Produces: Postgres на `localhost:5432` (база `palitra`, користувач `palitra`, пароль `palitra`), Mailpit SMTP на `localhost:1025` і його веб-інтерфейс на `http://localhost:8025`

**Передумова:** Docker Desktop має бути запущений. Перевірити: `docker info` повертає версію сервера без помилки.

- [ ] **Step 1: Створити `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: palitra-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: palitra
      POSTGRES_PASSWORD: palitra
      POSTGRES_DB: palitra
      TZ: Europe/Kyiv
    ports:
      - '5432:5432'
    volumes:
      - palitra-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U palitra -d palitra']
      interval: 5s
      timeout: 5s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest
    container_name: palitra-mailpit
    restart: unless-stopped
    ports:
      - '1025:1025'
      - '8025:8025'
    environment:
      MP_MAX_MESSAGES: 500
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

volumes:
  palitra-pgdata:
```

Дві примітки. По-перше, у спеці згаданий MailHog, але тут стоїть **Mailpit** — MailHog не оновлювався з 2020 року, а Mailpit є його прямим наступником від того ж автора з тим самим призначенням і живішою підтримкою. По-друге, `axllent/mailpit:latest` треба замінити на конкретний тег після першого `docker compose pull`, коли буде видно реальну версію — плаваючий тег у compose рано чи пізно приносить сюрприз.

- [ ] **Step 2: Створити `.env.example` у корені**

```dotenv
# Скопіювати у .env і за потреби змінити
DATABASE_URL=postgresql://palitra:palitra@localhost:5432/palitra?schema=public
```

- [ ] **Step 3: Створити `apps/api/.env.example`**

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://palitra:palitra@localhost:5432/palitra?schema=public
WEB_ORIGIN=http://localhost:3000

SMTP_HOST=localhost
SMTP_PORT=1025
```

- [ ] **Step 4: Підняти сервіси**

```bash
docker compose up -d
```

Очікується: обидва контейнери створені й запущені.

- [ ] **Step 5: Дочекатися готовності Postgres і перевірити підключення**

```bash
docker compose ps
docker compose exec postgres psql -U palitra -d palitra -c "SELECT version();"
```

Очікується: `palitra-postgres` у стані `healthy`; `psql` друкує версію PostgreSQL 17.

- [ ] **Step 6: Перевірити, що розширення `btree_gist` доступне**

```bash
docker compose exec postgres psql -U palitra -d palitra -c "SELECT name FROM pg_available_extensions WHERE name = 'btree_gist';"
```

Очікується: один рядок `btree_gist`. Це критично — на ньому тримається захист від подвійного бронювання з етапу 3. Якщо рядка немає, образ не підходить.

- [ ] **Step 7: Перевірити веб-інтерфейс Mailpit**

Відкрити `http://localhost:8025` — має відкритись порожня скринька.

- [ ] **Step 8: Створити локальні `.env` із прикладів**

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

- [ ] **Step 9: Коміт**

```bash
git add docker-compose.yml .env.example apps/api/.env.example
git commit -m "chore: add postgres and mailpit via docker compose"
```

---

### Task 6: Prisma 7 і реальна перевірка БД

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260813000000_enable_btree_gist/migration.sql`
- Create: `apps/api/prisma/migrations/migration_lock.toml`
- Create: `apps/api/src/lib/prisma.ts`
- Create: `apps/api/src/lib/database-check.ts`
- Create: `apps/api/src/lib/database-check.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `createApp` із Task 4, Postgres із Task 5
- Produces:
  - `prisma` — синглтон `PrismaClient`
  - `interface QueryableClient { $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }`
  - `createDatabaseCheck(client: QueryableClient): () => Promise<boolean>`

- [ ] **Step 1: Додати Prisma в залежності API**

У `apps/api/package.json` додати в `dependencies`:

```json
"@prisma/client": "7.9.1"
```

у `devDependencies`:

```json
"prisma": "7.9.1"
```

і в `scripts`:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:studio": "prisma studio"
```

Потім:

```bash
pnpm install
```

- [ ] **Step 2: Створити `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

У Prisma 7 генератор називається `prisma-client` (старий `prisma-client-js` оголошений застарілим), а поле `output` стало **обов'язковим** — згенерований код тепер лежить у твоєму репозиторії, а не в `node_modules`. Каталог `apps/api/src/generated/` уже внесено в `.gitignore` у Task 1.

Моделей тут поки немає навмисно: доменні сутності приходять на етапах 1–4.

- [ ] **Step 3: Створити `apps/api/prisma/migrations/migration_lock.toml`**

```toml
provider = "postgresql"
```

- [ ] **Step 4: Створити міграцію, що вмикає `btree_gist`**

Створити `apps/api/prisma/migrations/20260813000000_enable_btree_gist/migration.sql`:

```sql
-- Потрібне для exclusion constraint, що не дає двом заняттям
-- одного викладача перетинатися в часі (етап 3).
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Міграція створюється вручну, бо `prisma migrate dev` генерує SQL зі змін схеми, а ввімкнення розширення зі схеми не виводиться.

- [ ] **Step 5: Застосувати міграцію**

```bash
cd apps/api && pnpm db:deploy
```

Очікується: `1 migration found`, `Applied migration 20260813000000_enable_btree_gist`.

- [ ] **Step 6: Перевірити, що розширення справді встановлене**

```bash
docker compose exec postgres psql -U palitra -d palitra -c "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"
```

Очікується: один рядок `btree_gist`.

- [ ] **Step 7: Згенерувати клієнт**

```bash
cd apps/api && pnpm db:generate
```

Очікується: клієнт згенеровано в `apps/api/src/generated/prisma`.

- [ ] **Step 8: Написати падаючий тест на перевірку БД**

Створити `apps/api/src/lib/database-check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabaseCheck } from './database-check.js';

describe('createDatabaseCheck', () => {
  it('returns true when the query succeeds', async () => {
    const check = createDatabaseCheck({ $queryRaw: async () => [{ ok: 1 }] });
    await expect(check()).resolves.toBe(true);
  });

  it('returns false when the query rejects', async () => {
    const check = createDatabaseCheck({
      $queryRaw: async () => {
        throw new Error('connection refused');
      },
    });
    await expect(check()).resolves.toBe(false);
  });

  it('does not leak the underlying error', async () => {
    const check = createDatabaseCheck({
      $queryRaw: async () => {
        throw new Error('password authentication failed for user "palitra"');
      },
    });
    await expect(check()).resolves.toBe(false);
  });
});
```

Третій тест фіксує вимогу безпеки: `/health` доступний без авторизації, тому текст помилки підключення — з іменем користувача чи хостом — назовні потрапляти не повинен.

- [ ] **Step 9: Запустити тест і переконатися, що він падає**

```bash
pnpm --filter @palitra/api test
```

Очікується: FAIL — `Failed to resolve import "./database-check.js"`

- [ ] **Step 10: Реалізувати `apps/api/src/lib/database-check.ts`**

```ts
export interface QueryableClient {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

export function createDatabaseCheck(client: QueryableClient): () => Promise<boolean> {
  return async () => {
    try {
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  };
}
```

- [ ] **Step 11: Запустити тести й переконатися, що вони проходять**

```bash
pnpm --filter @palitra/api test
```

Очікується: PASS, 7 тестів (4 з Task 4 плюс 3 нові).

- [ ] **Step 12: Створити `apps/api/src/lib/prisma.ts`**

```ts
import { PrismaClient } from '../generated/prisma/client.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

Синглтон через `globalThis` потрібен через `tsx watch`: без нього кожне перезавантаження створює новий пул з'єднань, і Postgres швидко впирається в ліміт.

- [ ] **Step 13: Підключити справжню перевірку в `apps/api/src/server.ts`**

Замінити вміст файлу на:

```ts
import { createApp } from './http/app.js';
import { createDatabaseCheck } from './lib/database-check.js';
import { loadEnv } from './lib/env.js';
import { prisma } from './lib/prisma.js';

const env = loadEnv();

const app = createApp({
  checkDatabase: createDatabaseCheck(prisma),
  webOrigin: env.WEB_ORIGIN,
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
```

- [ ] **Step 14: Запустити API вручну й перевірити `/health` наживо**

```bash
pnpm --filter @palitra/api dev
```

В іншому терміналі:

```bash
curl -s http://localhost:4000/health
```

Очікується: `{"status":"ok","uptimeSeconds":<число>,"database":"up"}` і код 200.

- [ ] **Step 15: Перевірити поведінку при недоступній БД**

```bash
docker compose stop postgres
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/health
docker compose start postgres
```

Очікується: `503`. Після запуску Postgres назад `/health` знову віддає 200. Зупинити `pnpm dev`.

- [ ] **Step 16: Перевірити лінт і типи**

```bash
pnpm --filter @palitra/api lint
pnpm --filter @palitra/api typecheck
```

Очікується: без помилок.

- [ ] **Step 17: Коміт**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): wire prisma and add real database health check"
```

---

### Task 7: Типізований клієнт — `packages/api-client`

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/eslint.config.js`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/vitest.config.ts`
- Create: `packages/api-client/src/client.ts`
- Create: `packages/api-client/src/client.test.ts`
- Create: `packages/api-client/src/index.ts`

**Interfaces:**
- Consumes: `@palitra/shared` — `healthResponseSchema`, `apiErrorSchema`, `type HealthResponse`
- Produces:
  - `createApiClient(options: { baseUrl: string; fetch?: typeof globalThis.fetch }): ApiClient`
  - `interface ApiClient { getHealth(): Promise<HealthResponse> }`
  - `class ApiClientError extends Error` з полями `code`, `status`

- [ ] **Step 1: Створити `packages/api-client/package.json`**

```json
{
  "name": "@palitra/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@palitra/shared": "workspace:*",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@palitra/config": "workspace:*",
    "eslint": "10.8.1",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 1a: Створити `packages/api-client/eslint.config.js`**

```js
export { default } from '@palitra/config/eslint';
```

- [ ] **Step 2: Створити `packages/api-client/tsconfig.json`**

```json
{
  "extends": "@palitra/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"]
  },
  "include": ["src/**/*.ts"]
}
```

`DOM` потрібен заради типу `fetch` — клієнт має працювати і в браузері, і в Node 22, де `fetch` уже вбудований.

- [ ] **Step 3: Створити `packages/api-client/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Написати падаючий тест**

Створити `packages/api-client/src/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiClientError, createApiClient } from './client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('requests the health endpoint on the configured base url', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: 'ok', uptimeSeconds: 1, database: 'up' });
      },
    });

    const health = await client.getHealth();

    expect(calls).toEqual(['http://api.test/health']);
    expect(health.status).toBe('ok');
  });

  it('strips a trailing slash from the base url', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test/',
      fetch: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: 'ok', uptimeSeconds: 1, database: 'up' });
      },
    });

    await client.getHealth();

    expect(calls).toEqual(['http://api.test/health']);
  });

  it('throws ApiClientError carrying the domain code on an error response', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ code: 'NOT_FOUND', message: 'Route not found' }, 404),
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('throws when the payload does not match the schema', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ status: 'fine', uptimeSeconds: 1, database: 'up' }),
    });

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiClientError);
  });
});
```

Четвертий тест — головний сенс цього пакета. Якщо API колись змінить форму відповіді, клієнт впаде одразу з ясною помилкою, а не віддасть у React об'єкт із `undefined` усередині.

- [ ] **Step 5: Запустити тест і переконатися, що він падає**

```bash
pnpm --filter @palitra/api-client test
```

Очікується: FAIL — `Failed to resolve import "./client.js"`

- [ ] **Step 6: Реалізувати `packages/api-client/src/client.ts`**

```ts
import {
  apiErrorSchema,
  healthResponseSchema,
  type DomainErrorCode,
  type HealthResponse,
} from '@palitra/shared';

export class ApiClientError extends Error {
  readonly code: DomainErrorCode | 'BAD_RESPONSE';
  readonly status: number;

  constructor(code: DomainErrorCode | 'BAD_RESPONSE', message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function requestJson(path: string): Promise<unknown> {
    const response = await fetchImpl(`${root}${path}`);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.code : 'BAD_RESPONSE',
        parsed.success ? parsed.data.message : `Request to ${path} failed`,
        response.status,
      );
    }

    return payload;
  }

  return {
    async getHealth(): Promise<HealthResponse> {
      const payload = await requestJson('/health');
      const parsed = healthResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError('BAD_RESPONSE', 'Unexpected /health payload shape', 200);
      }
      return parsed.data;
    },
  };
}
```

- [ ] **Step 7: Створити `packages/api-client/src/index.ts`**

```ts
export * from './client.js';
```

- [ ] **Step 8: Запустити тести, лінт і типи**

```bash
pnpm --filter @palitra/api-client test
pnpm --filter @palitra/api-client lint
pnpm --filter @palitra/api-client typecheck
```

Очікується: PASS 4 тести, лінт і typecheck без помилок.

- [ ] **Step 9: Коміт**

```bash
git add packages/api-client pnpm-lock.yaml
git commit -m "feat(api-client): add typed client with schema-validated health call"
```

---

### Task 8: Веб-застосунок і шар дизайн-токенів

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/eslint.config.js`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/.env.example`

**Interfaces:**
- Consumes: `@palitra/api-client` — `createApiClient`; `@palitra/shared` — `type HealthResponse`
- Produces: шар CSS-змінних `--pt-*` (колір, типографіка, відступи, радіуси, тіні), доступний усім наступним етапам

**Про дизайн.** Це ще не верстка сайту — це фундамент під неї. Токени виводяться з брендингу, описаного в спеці, і фіксують три речі, які потім дорого міняти: палітру з перевіреними контрастами, типографічну пару й шкалу відступів. Сама сторінка навмисно мінімальна: вона показує статус API, а не дизайн.

Типографічна пара обрана під бренд, а не за замовчуванням. **Unbounded** — геометричний дисплейний гротеск із широкими формами, що перегукується з розрідженим капітелем логотипа. **Onest** — нейтральний UI-гротеск для тексту. Обидва мають повну кирилицю з `і ї є ґ`, що перевірено: підмножина `cyrillic` покриває `U+0400-045F` плюс `U+0490-0491`.

Свідомо **не** беремо високонтрастний сериф — кремове тло в парі з таким серифом і теплим акцентом дає рівно той вигляд, у який зараз скочується типовий згенерований дизайн. Кремове тло тут диктує бренд, тому відрізнятись мусить типографіка.

- [ ] **Step 1: Створити `apps/web/package.json`**

```json
{
  "name": "@palitra/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@palitra/api-client": "workspace:*",
    "@palitra/shared": "workspace:*",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@palitra/config": "workspace:*",
    "@types/node": "22.20.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "eslint": "10.8.1",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 1a: Створити `apps/web/eslint.config.js`**

```js
export { default } from '@palitra/config/eslint';
```

- [ ] **Step 2: Створити `apps/web/tsconfig.json`**

```json
{
  "extends": "@palitra/config/tsconfig.react.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Створити `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@palitra/shared', '@palitra/api-client'],
};

export default config;
```

`transpilePackages` обов'язковий: внутрішні пакети віддають TypeScript-джерела без збірки, і без цієї опції Next відмовиться їх імпортувати.

- [ ] **Step 4: Створити `apps/web/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: Створити `apps/web/.env.example`**

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Далі скопіювати його: `cp apps/web/.env.example apps/web/.env.local`

- [ ] **Step 6: Створити `apps/web/src/styles/tokens.css`**

```css
:root {
  /* --- Колір -------------------------------------------------------
     Значення взяті з брендингу студії (див. спеку, розділ 7).
     Контрасти перевірені за WCAG 2.1 на тлі --pt-cream:
       ink        15.5:1   основний текст
       ink-soft    6.9:1   другорядний текст
       violet      5.0:1   можна як текст
       violet-deep 8.1:1   текст і кнопки
       tangerine   2.3:1   ТІЛЬКИ заливка, ніколи не текст
       leaf        1.8:1   ТІЛЬКИ декор
  ------------------------------------------------------------------ */
  --pt-cream: #f7f3ea;
  --pt-paper: #fffdf8;
  --pt-violet: #7b4fc9;
  --pt-violet-deep: #5b2e9e;
  --pt-tangerine: #f08a2c;
  --pt-leaf: #93c83e;
  --pt-ink: #1c1b22;
  --pt-ink-soft: #55525e;
  --pt-line: rgba(28, 27, 34, 0.12);

  /* --- Ролі --------------------------------------------------------- */
  --pt-bg: var(--pt-cream);
  --pt-surface: var(--pt-paper);
  --pt-text: var(--pt-ink);
  --pt-text-muted: var(--pt-ink-soft);
  --pt-primary: var(--pt-violet-deep);
  --pt-on-primary: #ffffff;
  --pt-accent-fill: var(--pt-tangerine);
  --pt-on-accent: var(--pt-ink);

  /* --- Типографіка --------------------------------------------------- */
  --pt-font-display: 'Unbounded', system-ui, sans-serif;
  --pt-font-body: 'Onest', system-ui, sans-serif;

  --pt-text-xs: 0.75rem;
  --pt-text-sm: 0.875rem;
  --pt-text-base: 1.0625rem;
  --pt-text-lg: 1.25rem;
  --pt-text-xl: clamp(1.5rem, 1.25rem + 1.2vw, 2rem);
  --pt-text-2xl: clamp(2rem, 1.5rem + 2.4vw, 3rem);
  --pt-text-3xl: clamp(2.5rem, 1.6rem + 4.4vw, 4.5rem);

  --pt-leading-tight: 1.1;
  --pt-leading-snug: 1.3;
  --pt-leading-normal: 1.6;

  --pt-tracking-display: -0.02em;
  --pt-tracking-wide: 0.08em;

  /* --- Відступи: крок 4px -------------------------------------------- */
  --pt-space-1: 0.25rem;
  --pt-space-2: 0.5rem;
  --pt-space-3: 0.75rem;
  --pt-space-4: 1rem;
  --pt-space-5: 1.5rem;
  --pt-space-6: 2rem;
  --pt-space-7: 3rem;
  --pt-space-8: 4rem;
  --pt-space-9: 6rem;
  --pt-space-10: 8rem;

  /* --- Радіуси: округлі, під органіку мазків ------------------------- */
  --pt-radius-sm: 0.5rem;
  --pt-radius-md: 0.875rem;
  --pt-radius-lg: 1.5rem;
  --pt-radius-pill: 999px;

  /* --- Тіні: підфарбовані фіолетовим, не сірим ----------------------- */
  --pt-shadow-sm: 0 1px 2px rgba(28, 27, 34, 0.06);
  --pt-shadow-md:
    0 1px 2px rgba(28, 27, 34, 0.06), 0 8px 24px -12px rgba(91, 46, 158, 0.22);

  --pt-container: 72rem;
}
```

- [ ] **Step 7: Створити `apps/web/src/styles/globals.css`**

```css
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--pt-bg);
  color: var(--pt-text);
  font-family: var(--pt-font-body);
  font-size: var(--pt-text-base);
  line-height: var(--pt-leading-normal);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  margin: 0;
  font-family: var(--pt-font-display);
  font-weight: 600;
  line-height: var(--pt-leading-tight);
  letter-spacing: var(--pt-tracking-display);
}

:focus-visible {
  outline: 3px solid var(--pt-violet);
  outline-offset: 3px;
  border-radius: var(--pt-radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Видимий фокус і повага до `prefers-reduced-motion` закладаються тут, у фундаменті. Якщо їх не поставити зараз, вони не з'являться ніколи — на етапі 5 буде вже пізно ходити по всіх компонентах.

- [ ] **Step 8: Створити `apps/web/src/lib/api.ts`**

```ts
import { createApiClient } from '@palitra/api-client';

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
});
```

- [ ] **Step 9: Створити `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import type { ReactNode } from 'react';
import '../styles/globals.css';

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-display-loaded',
  display: 'swap',
});

const onest = Onest({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Палітра талантів — музична студія в Черкасах',
  description:
    'Вокал, фортепіано, гітара та укулеле для дітей і дорослих. Індивідуальні та групові заняття.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Дві деталі, які легко зробити неправильно. Перша: підмножина `cyrillic-ext` тут не про запас — символ гривні ₴ (U+20B4) лежить саме в ній, і без неї ціни на етапі 5 покажуться прямокутником. Друга: поле `weight` не передається навмисно. Обидва шрифти варіативні (перевірено — Google Fonts віддає для них діапазон `wght@200..900`), тож без `weight` завантажується один файл із повним діапазоном ваг. Вказавши `weight`, ти отримаєш кілька статичних накреслень і втратиш проміжні.

- [ ] **Step 10: Прив'язати завантажені шрифти до токенів**

У `apps/web/src/styles/tokens.css` замінити два рядки в блоці типографіки на:

```css
  --pt-font-display: var(--pt-font-display-loaded), system-ui, sans-serif;
  --pt-font-body: var(--pt-font-body-loaded), system-ui, sans-serif;
```

`next/font` сам створює змінні `--pt-font-*-loaded` із реальними іменами сімейств і локальними резервними метриками, тому імена шрифтів у CSS вручну не пишуться.

- [ ] **Step 11: Створити `apps/web/src/app/page.tsx`**

```tsx
import type { HealthResponse } from '@palitra/shared';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function loadHealth(): Promise<HealthResponse | null> {
  try {
    return await api.getHealth();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await loadHealth();

  return (
    <main
      style={{
        maxWidth: 'var(--pt-container)',
        margin: '0 auto',
        padding: 'var(--pt-space-9) var(--pt-space-5)',
      }}
    >
      <p
        style={{
          margin: `0 0 var(--pt-space-4)`,
          color: 'var(--pt-primary)',
          fontSize: 'var(--pt-text-sm)',
          fontWeight: 700,
          letterSpacing: 'var(--pt-tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        Черкаси · з 2011 року
      </p>

      <h1 style={{ fontSize: 'var(--pt-text-3xl)', maxWidth: '18ch' }}>Палітра талантів</h1>

      <p
        style={{
          maxWidth: '42ch',
          margin: 'var(--pt-space-5) 0 var(--pt-space-7)',
          color: 'var(--pt-text-muted)',
          fontSize: 'var(--pt-text-lg)',
        }}
      >
        Вокал, фортепіано, гітара та укулеле — для дітей і дорослих.
      </p>

      <section
        style={{
          background: 'var(--pt-surface)',
          border: `1px solid var(--pt-line)`,
          borderRadius: 'var(--pt-radius-lg)',
          boxShadow: 'var(--pt-shadow-md)',
          padding: 'var(--pt-space-6)',
        }}
      >
        <h2 style={{ fontSize: 'var(--pt-text-lg)' }}>Стан системи</h2>
        <p style={{ margin: 'var(--pt-space-3) 0 0', color: 'var(--pt-text-muted)' }}>
          {health === null
            ? 'API недоступний. Перевірте, що запущено pnpm dev і Docker Compose.'
            : `API відповідає. База даних: ${health.database === 'up' ? 'підключена' : 'недоступна'}.`}
        </p>
      </section>
    </main>
  );
}
```

Інлайнові стилі тут — свідомо тимчасове рішення для однієї службової сторінки. Вибір між CSS-модулями й іншим підходом робиться на етапі 5 разом із рештою верстки; закладати його заради сторінки статусу було б передчасно.

- [ ] **Step 12: Запустити обидва застосунки й перевірити наскрізний зв'язок**

Переконатися, що Docker Compose піднятий, і з кореня:

```bash
pnpm dev
```

Відкрити `http://localhost:3000`.

Очікується: сторінка на кремовому тлі, заголовок набраний Unbounded, у картці — «API відповідає. База даних: підключена.»

- [ ] **Step 13: Перевірити, що деградація відображається**

```bash
docker compose stop postgres
```

Оновити сторінку. Очікується: «API відповідає. База даних: недоступна.»

```bash
docker compose start postgres
```

Оновити ще раз — має повернутись «підключена». Зупинити `pnpm dev`.

- [ ] **Step 14: Перевірити збірку, лінт і типи**

```bash
pnpm --filter @palitra/web build
pnpm --filter @palitra/web lint
pnpm --filter @palitra/web typecheck
```

Очікується: збірка успішна, лінт і typecheck без помилок.

- [ ] **Step 15: Коміт**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add next.js app with brand design tokens and status page"
```

---

### Task 9: Безперервна інтеграція

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `apps/api/package.json` (додати скрипт `test:ci`)

**Interfaces:**
- Consumes: скрипти `lint`, `typecheck`, `test`, `build` з усіх пакетів
- Produces: workflow, що проганяє перевірки на кожен push і pull request

- [ ] **Step 1: Створити `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: palitra
          POSTGRES_PASSWORD: palitra
          POSTGRES_DB: palitra
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U palitra -d palitra"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://palitra:palitra@localhost:5432/palitra?schema=public
      NEXT_PUBLIC_API_URL: http://localhost:4000

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: 11.21.0

      - uses: actions/setup-node@v5
        with:
          node-version: 22.19.0
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Apply database migrations
        run: pnpm --filter @palitra/api db:deploy

      - name: Generate prisma client
        run: pnpm --filter @palitra/api db:generate

      - name: Lint
        run: pnpm lint

      - name: Check formatting
        run: pnpm format:check

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

Міграції й генерація клієнта йдуть **до** лінту й перевірки типів. Причина конкретна: Prisma 7 кладе згенерований клієнт у `apps/api/src/generated/`, який не комітиться. Якщо запустити `typecheck` раніше, він впаде на неіснуючому імпорті в `lib/prisma.ts`.

- [ ] **Step 2: Перевірити повний ланцюжок локально — так само, як його бачитиме CI**

```bash
pnpm install --frozen-lockfile
pnpm --filter @palitra/api db:deploy
pnpm --filter @palitra/api db:generate
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Очікується: усі вісім команд завершуються з кодом 0.

- [ ] **Step 3: Коміт**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, typecheck, test and build workflow"
```

---

## Критерій готовності етапу

Етап 0 закритий, коли всі пункти виконуються:

- [ ] `pnpm install --frozen-lockfile` проходить на чистому клоні
- [ ] `docker compose up -d` піднімає Postgres у стані `healthy` і Mailpit на `:8025`
- [ ] `pnpm dev` стартує API на `:4000` і веб на `:3000`
- [ ] `curl http://localhost:4000/health` віддає 200 і `"database":"up"`
- [ ] Зупинений Postgres переводить `/health` у 503 і `"database":"down"`
- [ ] `http://localhost:3000` показує статус API, набраний брендовими шрифтами
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` — усі зелені
- [ ] Розширення `btree_gist` встановлене в базі
- [ ] CI зелений на гілці `dev`
