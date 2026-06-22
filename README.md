# CampusPay

CampusPay is a synthetic education-finance app for creating and tracking student tuition payment
requests across students, university finance teams, lenders, and payment operations.

Live demo: [https://campuspay-xrpl.web.app](https://campuspay-xrpl.web.app)

The current web app is Firebase-backed and uses Firestore directly from the React client. All bundled
records and accounts are demo data. **No real money moves.** Payment, lender, compliance, FX, and
payout activity are represented as workflow states, not live integrations.

The repository still includes the NestJS/domain/XRPL packages from the broader TuitionFlow platform,
but the deployed CampusPay web experience uses Firestore as its active data path.

## Current Experience

- Landing page with a minimal SaaS-style entry point.
- Secure sign-in screen with account-type dropdown for the demo environment.
- Student dashboard scoped to one student and one university.
- One payment per student/university/semester, enforced in the Firestore client path.
- Read-only payment tracking page for every role.
- University finance dashboard scoped to one partner college.
- SBI lender dashboard with approval/disbursement lifecycle buckets and UTR recording.
- Payment operations dashboard with KPI summary cards, priority transactions, lifecycle mix, and a
  separate transactions workbench.

## Demo Accounts

All accounts use password `DemoPass123!`.

| Role               | Email                               | Scope                                                   |
| ------------------ | ----------------------------------- | ------------------------------------------------------- |
| Student            | `student@tuitionflow.local`         | Aarav Sharma at University of Warwick                   |
| University finance | `finance-warwick@tuitionflow.local` | University of Warwick payment queue only                |
| Lender officer     | `lender@tuitionflow.local`          | SBI disbursement approval and transfer-reference queue  |
| Payment ops        | `ops@tuitionflow.local`             | Portfolio summary, payment operations, and transactions |

## Routes

| Route                      | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `/`                        | Landing page                                |
| `/login`                   | Demo account sign-in                        |
| `/dashboard`               | Role-specific dashboard                     |
| `/payments/new`            | Student payment request form                |
| `/payments/:id`            | Read-only tracking and payment-summary page |
| `/operations/transactions` | Payment operations transaction workbench    |

## Local Web Development

Prerequisites:

- Node.js 20+
- pnpm 11.7.0 through Corepack

```bash
corepack enable
pnpm install
pnpm --filter @tuitionflow/web dev
```

Open `http://localhost:5173`.

The web app defaults to the Firebase project `campuspay-xrpl` through
`apps/web/src/firebase/client.ts`. Production build variables are in `apps/web/.env.production`.

## Firebase

Firebase project: `campuspay-xrpl`

Configured files:

- `.firebaserc` selects `campuspay-xrpl`.
- `firebase.json` deploys `apps/web/dist` and rewrites all routes to `index.html`.
- `firestore.rules` allows demo reads/writes to `journeyCases`.
- `scripts/seed-firestore.mjs` resets and seeds the demo `journeyCases` collection.

Seed Firestore demo data:

```bash
pnpm firebase:seed
```

The seed script uses `gcloud auth print-access-token`, so the local Google Cloud CLI must be
authenticated with access to the Firebase project.

Deploy hosting and Firestore rules:

```bash
pnpm firebase:deploy
```

## Verification

Recommended checks for the current app:

```bash
pnpm --filter @tuitionflow/web typecheck
pnpm lint
pnpm --filter @tuitionflow/web build
```

Full workspace checks are still available for the broader monorepo:

```bash
pnpm -r build
pnpm -r test
```

## Monorepo Layout

```text
packages/domain   Pure domain model and guarded payment/remittance state machine
packages/xrpl     Optional XRPL Testnet hash-attestation gateway
packages/rails    Rail adapter interfaces and simulator/stub adapters
apps/api          NestJS API, auth, Prisma, encryption, PDFs, and webhooks
apps/web          React 19 + Vite 6 + Tailwind CSS 4 CampusPay UI
config            Corridor/routing configuration
infra             PostgreSQL Compose and backup/restore verification
scripts           Firestore seed utilities
```

## Safety Notes

- The deployed Firebase rules are intentionally permissive for the synthetic demo collection.
- Do not use the current Firebase project or rules for real payment, student, lender, or university
  data.
- Firebase client config in this repo is public web-app configuration, not a private service-account
  secret.
- XRPL attestation code remains optional and only writes SHA-256 hashes when enabled.

See [COMPLIANCE.md](COMPLIANCE.md) for the regulatory operating model and live-money rollout gates,
and [SECURITY.md](SECURITY.md) for implemented controls and remaining production approvals.
