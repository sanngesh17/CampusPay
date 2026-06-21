# Security status

## Implemented and tested

- Argon2id seeded demo credentials, short JWT access tokens, rotating refresh cookies, RBAC, and
  case ownership/lender-assignment checks.
- AES-256-GCM encryption for personal, PAN, loan-account, evidence, instruction, and receipt data.
- Local and S3-compatible private object-storage adapters with authorised downloads.
- PDF/JPEG/PNG type, extension, magic-byte, size, SHA-256, and malware-test-signature checks.
- Actor-scoped payout idempotency; signed timestamped webhook ingestion with nonce replay protection,
  event idempotency, and out-of-order status rejection.
- Security headers, pinned production CORS, origin checks, request limits, log redaction, environment
  secrets, readiness checks, PostgreSQL migrations, and backup/restore verification.
- Versioned consent evidence; access, correction, erasure, and consent-withdrawal requests; personal
  data export; legal holds; retention erasure; grievances; immutable privileged-action audit events.
- XRPL accepts 64-hex SHA-256 hashes only. Personal or payment data is never written on chain.

## Production gates

This code is compliance-ready, not independently certified. Live data or money remains blocked until:

- PA-CB/AD bank and Ripple contracts, credentials, corridor, collection account, and fund flow are approved.
- Independent application, cloud, dependency, penetration, and restore testing is completed.
- KMS/HSM key custody and rotation replace raw application encryption keys.
- MFA/SSO, production identity lifecycle, four-eyes payout approval, and privileged access management are enabled.
- India-resident payment-data architecture, SIEM retention, CERT-In incident reporting, BCP/DR, and vendor
  outsourcing controls are independently validated.
- Operational malware scanning uses an approved scanner service; the bundled scanner is deterministic demo screening.

Never use synthetic Render staging for real PAN, passport, loan, account, address, or payment data.
