# CampusPay

CampusPay is an education-finance orchestration layer for foreign tuition payments from India to
global universities. The product goal is to connect student payment initiation, lender disbursement,
licensed PA-CB compliance/FX execution, Ripple Payments Direct settlement, and university
reconciliation into one auditable workspace.

Live demo: [https://campuspay-xrpl.web.app](https://campuspay-xrpl.web.app)

The current web app is Firebase-backed and uses Firestore directly from the React client. All bundled
records and accounts are demo data. **No real money moves.** The deployed CampusPay experience is a
synthetic product demo; Ripple, lender, FX, PA-CB, KYC, LRS, FEMA, TCS, and payout activity are
represented as workflow states, not live integrations.

The repository still includes the NestJS/domain/XRPL packages from the broader TuitionFlow platform,
but the deployed CampusPay web experience uses Firestore as its active data path.

## Product Thesis

Foreign tuition payments are still fragmented across student forms, bank branches, forex providers,
manual documents, email follow-ups, and university reconciliation queues. That creates four core
problems:

- Students face high FX spreads, repeated document collection, and delays under enrollment
  deadlines.
- Lenders lack a clean audit trail showing sanctioned education-loan funds reached the university.
- Universities receive payments that are hard to match against student records and semester fees.
- Operations teams reconcile status, receipts, exceptions, and payout movement across too many
  systems.

CampusPay’s target operating model is a lender-first, partner-led payment workflow:

1. Student initiates a semester tuition payment.
2. Lender reviews the request, approves the sanctioned-loan release, and records transfer evidence.
3. CampusPay coordinates the workflow with a licensed PA-CB partner for KYC, LRS, FEMA, TCS, quote,
   FX, and payout execution.
4. Ripple Payments Direct is the target settlement rail for fast, attested cross-border movement.
5. University finance receives a clean payment tracking and reconciliation view.

The intended gap versus existing options is the education-specific workflow layer: payment networks
such as Flywire and Convera integrate with universities but still use traditional payment rails;
authorised dealer banks are regulated and trusted but branch-heavy and manual; consumer remittance
products are faster for individuals but do not solve lender-controlled release, university fee
verification, or education-loan reconciliation.

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

## Market and Rollout Direction

The reference deck frames the opportunity around India’s outbound education market:

- Estimated annual overseas-education spend by Indian students: `$70B`.
- RBI-reported outstanding education-loan portfolio: `₹97,756 crore` as of mid-2023, used as a
  public proxy for loan-funded scale.
- Initial destination focus: UK/US corridors, with Canada and Australia also part of the high-volume
  outbound student landscape.

The rollout plan is phased:

1. Foundations and regulatory fit with partner banks, legal review, and 1-2 design partners.
2. MVP pilot with 1-2 banks and a small university set on one corridor.
3. Deeper lender and university workflow integrations, richer reconciliation, multi-currency support,
   and education-specific analytics.
4. Expansion from one source country and corridor set to a broader multi-origin platform.

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
