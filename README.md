# CampusPay

Compliance-ready, synthetic-data demonstration of an India-to-UK education-loan payment workflow.
CampusPay orchestrates regulated partners; it does not hold funds, sanction loans, calculate
authoritative tax, or act as an RBI-authorised payment operator.

All bundled partner connections are deterministic simulators. **No real money moves.** XRPL
attestation is optional, disabled by default, and contains SHA-256 hashes only.

## Student journey

The primary web flow is a five-step experience:

1. Select the United Kingdom and one of five universities.
2. Enter tuition, deposit, accommodation, and other fee amounts; India is the source country.
3. Select full sanctioned-loan financing (the only enabled funding type in this release).
4. Select SBI, HDFC Bank, Kotak Mahindra Bank, Credila, or Avanse.
5. Enter student, payer, branch, and sanctioned-loan details; upload synthetic evidence and submit.

An approved simulated compliance decision creates an immutable encrypted payment-initiation PDF
with a stable collection reference. It explicitly states that it is not proof of payment.

## Local demo

```bash
corepack pnpm install
corepack pnpm demo
```

Open `http://localhost:5173`. Use password `DemoPass123!` for all three synthetic accounts:

| Role               | Email                       | Responsibility                                                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Student            | `student@tuitionflow.local` | Create and track payment, download instruction/receipt, submit privacy requests and grievances   |
| Lender officer     | `lender@tuitionflow.local`  | Review evidence, approve an existing sanctioned-loan disbursement, record synthetic UTR          |
| Payment operations | `ops@tuitionflow.local`     | Verify funding, quote, submit/advance payout, reconcile, resolve exceptions and privacy requests |

The default mode uses encrypted local private storage and a JSON snapshot, so Docker is not needed.

## Persistent local demo

```bash
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm demo:full
```

This uses PostgreSQL 16 and encrypted private local storage. Readiness is at
`http://localhost:3000/health/ready`.

## Verification

```bash
corepack pnpm -r build
corepack pnpm -r test
corepack pnpm lint
corepack pnpm db:backup-restore-smoke
docker build -t tuitionflow:local .
```

The test suite covers the three-role journey, RBAC, encryption, signed/replay-protected webhooks,
idempotency, partner failures, immutable PDFs, DPDP requests, legal holds, and retention exclusions.

## Storage and deployment

- `PRIVATE_STORAGE=local` stores application-encrypted objects under `.data/private`.
- `PRIVATE_STORAGE=s3` enables an S3/MinIO/R2-compatible adapter. Configure the `S3_*` variables in
  `.env.example`; bucket encryption is requested in addition to application AES-256-GCM encryption.
- `render.yaml` deploys a synthetic-only staging service with managed PostgreSQL and private disk.
- Production payment data requires partner-approved India-resident infrastructure where applicable.

See [COMPLIANCE.md](COMPLIANCE.md) for the regulatory operating model and live-money rollout gates,
and [SECURITY.md](SECURITY.md) for implemented controls and remaining production approvals.

## Monorepo

```text
packages/domain   Pure domain model and guarded remittance state machine
packages/xrpl     Optional XRPL Testnet hash-attestation gateway
packages/rails    Compliance and Payments Direct shaped adapters/simulators
apps/api          NestJS API, auth, Prisma, encryption, PDFs, webhooks
apps/web          React/Vite/Tailwind student, lender, and operations UI
config            Effective corridor/routing configuration
infra             PostgreSQL Compose and backup/restore verification
```
