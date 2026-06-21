# CLAUDE.md — TuitionFlow

## What this is

Cross-border tuition-payment platform. Payment milestones are anchored on the **XRPL Testnet** as sha256 hashes only (never PII). Money routes through swappable "rails" — the MVP ships `MockRailAdapter` (no real money moves).

## Monorepo layout

```
packages/domain   → Pure domain model (value objects, entities, state machine, events). No framework deps.
packages/xrpl     → XRPL Testnet gateway (xrpl.js 4.x). No xrpl.js types leak past this boundary.
packages/rails    → RailAdapter interface + MockRailAdapter + PA-CB/AD-bank/Ripple stubs.
apps/api          → NestJS orchestration (Prisma, encryption, idempotency, HMAC, attestation wiring).
apps/web          → React 19 + Vite 6 + Tailwind CSS 4 + React Query 5. 5-screen wizard + admin.
config/           → tcs.json, rails.json (config-driven rates/limits — never hardcode).
infra/            → docker-compose.yml (Postgres 16).
```

Build order: `domain → xrpl → rails → api`. Web is independent.

## Quick start

```bash
pnpm install
pnpm demo          # builds API, then runs API (:3000) + web (:5173) concurrently
```

No database or XRPL network required — API runs in-memory with a recording attestation gateway.

## Build / test / lint

```bash
pnpm -r build                                    # all packages + API
pnpm -r test                                     # 59 tests: domain(26) + xrpl(9) + rails(12) + api(12)
pnpm lint                                        # ESLint across workspace
pnpm --filter @tuitionflow/xrpl test:integration  # live Testnet (faucet-funded, skips offline)
pnpm --filter @tuitionflow/api test:personas      # Persona A+B on real Testnet (~25s each, skips offline)
```

## Module system & TypeScript

- **CommonJS everywhere** (`target ES2022`, `module CommonJS`). Avoids ESM/CJS friction with NestJS decorators, ts-jest, and Prisma on Windows.
- Exception: `apps/web` is `"type": "module"` (Vite requires ESM).
- Strict flags: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`.
- Packages compile with `tsc` to `dist/`. Cross-package imports via `workspace:*` deps.

## Key conventions

### Money

Always `BigInt` minor units (paise for INR) + currency string. **Never use floats for money.** The `Money` value object enforces this — `Money.of(amount, currency)` rejects negatives, arithmetic guards same-currency.

### State machine

`CaseStatus` is a **string enum** (not numeric). The full guarded transition table is in `packages/domain/src/state-machine/transitions.ts`. Illegal transitions throw `IllegalTransition`. Attestation-worthy milestones: `VALIDATED`, `QUOTE_LOCKED`, `PAID`, `RECONCILED`.

### IDs

Branded types (`CaseId`, `StudentId`, etc.) in `packages/domain/src/value-objects/ids.ts`. Generated with `crypto.randomUUID()`.

### Domain events

`TuitionCase` is the aggregate root. Behaviour methods (`validate()`, `lockQuote()`, `markPaid()`, etc.) guard via state machine, push domain events, and expose them via `pullEvents()`.

## Security invariants (enforced by tests)

1. **No PII on-chain** — only sha256 hashes, pseudonymous case IDs, timestamps, credential status. `assertIsHash` in `packages/xrpl` rejects anything that isn't a 64-hex hash.
2. **No real money** — `MockRailAdapter` only. Real partner adapters throw `NotImplemented`.
3. **PII encrypted at rest** — `pan`/`passport`/`bankAccount` use AES-256-GCM via `FieldCipher`. Tests assert stored values are ciphertext.
4. **Idempotent payment initiation** — `Idempotency-Key` header required on `POST /cases/:id/initiate`. Same key = same result, no duplicate payment.
5. **HMAC on webhooks** — `POST /webhooks/partner` requires `x-signature` header, constant-time compare.
6. **No PII/secrets in logs** — `RedactingLogger` strips emails, PAN, seeds, `secret=`/`key=` patterns.
7. **Secrets from env only** — `ENCRYPTION_KEY`, `PARTNER_WEBHOOK_HMAC_SECRET`, `XRPL_ISSUER_SEED`. `.env` is gitignored.

## API endpoints

| Method | Path                        | Purpose                                       |
| ------ | --------------------------- | --------------------------------------------- |
| POST   | /cases                      | Create a case                                 |
| POST   | /cases/:id/documents        | Add documents                                 |
| POST   | /cases/:id/validate         | Validate (triggers attestation)               |
| POST   | /cases/:id/quote            | Lock quote (triggers attestation)             |
| POST   | /cases/:id/initiate         | Initiate payment (requires `Idempotency-Key`) |
| POST   | /cases/:id/settle           | **Demo only** — settle without webhook HMAC   |
| GET    | /cases/:id                  | Case detail + timeline                        |
| GET    | /cases/:id/receipt          | Payment receipt                               |
| POST   | /webhooks/partner           | Partner webhook (HMAC-signed)                 |
| POST   | /admin/credentials          | Issue XLS-70 credential                       |
| GET    | /admin/attestations/:caseId | List attestations for a case                  |
| GET    | /admin/cases                | List all cases (admin)                        |
| GET    | /health                     | Liveness + uptime                             |

## Persistence modes

- **Default (in-memory):** No env needed. Seeded with demo personas at startup.
- **Prisma (Postgres):** Set `PERSISTENCE=prisma` + `DATABASE_URL`. Run `prisma migrate deploy` + seed.
- **XRPL attestations:** Set `XRPL_ENABLED=true` + `XRPL_ISSUER_SEED` (faucet-funded wallet).

## Web app (`apps/web`)

- Vite 6 + React 19 + Tailwind CSS v4 + React Query 5 + react-router-dom v7.
- Typed API client at `src/api/client.ts` — defaults to `http://localhost:3000`, override with `VITE_API_URL`.
- Screens: Onboarding → Create → Documents → Quote → Status → Receipt, plus Admin.

## xrpl.js under Jest

xrpl 4.x is ESM-only. For Jest (CommonJS), you need `transformIgnorePatterns` to transpile the full dep stack: `xrpl|ripple-*|@xrplf+*|@noble+*|@scure+*`. The better pattern (used in `apps/api`) is dynamic `import()` inside NestJS provider factories gated on `XRPL_ENABLED` env var, keeping the SDK out of test runtime entirely. See `apps/api/test/jest-personas.js` for the transpile config when you do need it.

## Known gaps (intentional, documented in SECURITY.md)

- No auth/JWT yet.
- Demo `POST /cases/:id/settle` bypasses webhook HMAC — must be gated/removed for prod.
- CORS is `origin: true` — pin to web origin in prod.
- Postgres migrate+seed not yet run live (Docker daemon was unavailable during build).
- Rate limiting not implemented.
