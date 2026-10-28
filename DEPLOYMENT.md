# CampusCart live deployment

Verified 28 October 2026.

- Storefront: https://campuscart.34.93.237.251.sslip.io/
- Staff sign-in: https://campuscart.34.93.237.251.sslip.io/admin/login
- Google Cloud project: `campuscart-512806`
- VM: `campuscart-web`, zone `asia-south1-a`, `e2-small`, 20 GB persistent boot disk
- Reserved address: `campuscart-ip`, `34.93.237.251`
- HTTP/HTTPS ingress: `campuscart-web` firewall rule. MongoDB is bound to localhost only and requires authentication.

## Runtime

Caddy provides HTTPS and redirects HTTP. `campuscart-app`, `campuscart-mongo`, and `campuscart-proxy` are Docker containers with restart policies. Source, database, uploads and TLS state live under `/srv/campuscart` on the VM disk. Secrets are in root-protected `/srv/campuscart/private/`; they are not stored in Git or the image.

The app container uses `--network host --pid host --uts host` so its checkout recovery sees the VM's actual process IDs and stable hostname. Do not replace this with isolated PID/hostname namespaces or scale to additional machines without adapting checkout recovery. App uploads mount `/srv/campuscart/uploads` at `/app/uploads`.

The VM boots Ubuntu's supported `6.8.0-147-generic` kernel because the default `7.0.0-1014-gcp` image triggered MongoDB's documented kernel compatibility guard. Boot selection is in `/etc/default/grub.d/99-campuscart-kernel.cfg`. Maintain supported kernel security updates and update the boot selection when upgrading; do not bypass MongoDB's guard.

## Data and tests

The initial migration copied 11 accounts, 196 products, 35 categories, 21 historical orders and 5 completed checkout records. There were no pending checkout reservations. Local and online databases are separate after migration; changes are not automatically synchronized.

Verified against the real HTTPS domain:

- Customer, Booth 4 shopkeeper and Super Administrator sign-in.
- Secure, HttpOnly login cookies and denied customer access to account administration.
- One labelled test COD order: `6ae0d3cdcd167aba9c94dd6c`, ₹40 item + ₹30 delivery = ₹70.
- Seller delivery confirmation, customer delivered history and Super Admin order visibility.
- Mobile viewport, uploaded image retrieval, and persistence after an application restart.

Additional live acceptance checks completed on 28 October 2026:

| Scenario | Order | Verified result |
| --- | --- | --- |
| 4H-only COD | `6ae11170fb595fcce67d99c7` | ₹45; shopkeeper completion appears as delivered in customer history |
| Booth 4 + 4H COD | `6ae111c9fb595fcce67d9b17` | ₹115; each shop sees only its own items; cross-shop completion denied; partial then full delivery verified |
| One on-time, one late | `6ae11241fb595fcce67d9e10` | Booth 4 ₹0 deduction; 4H ₹20 deduction; SA ledger verified; customer deduction hidden |

Temporary shop policies were restored immediately after the late-test order was created. Existing test orders and their snapshotted policies remain as verification records. The final read-only check confirmed HTTPS health, fresh customer login, the delivered order and persistent uploaded photo without creating another order.

The test delivery and COD collection were simulated; no physical delivery or real cash collection occurred.

## Handover scope

The requested college-project feature set and live COD demonstrations are complete. The full local regression run passed 17 tests with no skips, and the frontend production build passed. Online and local data are separate. Passwords are supplied privately, never in this document.

New public signup now requires college email OTP verification. Existing accounts retain access and their original ownership; they are not automatically marked email-verified. Late penalties remain ledger entries, not automatic bank deductions. Automated off-VM backups, online payments and a custom purchased domain are not configured. Menu stock and representative product photographs should be reviewed by the shops before accepting real student orders.


## Operations

```sh
gcloud compute ssh campuscart-web --project=campuscart-512806 --zone=asia-south1-a
sudo docker ps
sudo docker logs --tail 100 campuscart-app
sudo docker restart campuscart-app
```

Health endpoint: `/api/health`. On a future release, build a new image from the updated Git revision, retain the existing database/uploads/env files, stop the old app process, then recreate the app with the same host namespace flags and volume mappings. Do not re-import the original migration snapshot over the online database.

Persistent disk is not a separate backup. Automated off-VM backups are not yet configured. Back up MongoDB and uploads before VM/disk deletion or migrations. Deleting the VM can delete its boot disk; preserve/snapshot the disk first. The HTTPS hostname uses sslip.io DNS and the reserved IP; a custom domain can replace it later.

## Billing

This is an always-running Compute Engine VM, not scale-to-zero Cloud Run. VM, persistent disk, reserved external IP and network traffic may incur charges. Deployment was authorized with possible charges accepted. Billing is enabled; the remaining trial-credit balance was not independently verified. Review Google Cloud Billing before trial credits expire. Stopping the VM does not remove disk/IP charges.


## College email OTP (28 October 2026)

New registrations use POST `/api/users/registration-otp` to request a code, then POST `/api/users` with the returned `challengeId` and `otp` alongside name, email and password. The backend enforces the exact `nith.ac.in` domain and creates the customer only after consuming the code. Public requests cannot grant staff roles or set verification flags.

Codes are random six-digit values stored as HMAC digests, expire after ten minutes, permit five attempts, and are consumed atomically across workers. Resending replaces the previous challenge. MongoDB-backed limits allow five sends per email per hour, twenty sends per IP per hour, and sixty verification requests per IP per hour; each email has a sixty-second resend wait. The reverse proxy must be trusted only on loopback. Tune limits carefully if many students share a campus NAT address.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and optionally `SMTP_FROM`. Gmail uses `smtp.gmail.com`, port `587` with required STARTTLS and a Google App Password (not the account password). Local optional `.env.mail` and all `.env.*` secrets are excluded from Git and Docker build context. Production uses `/srv/campuscart/private/mail.env`, mode 600, supplied with a second `--env-file` when recreating the app container. Keep `--network host --pid host --uts host`, the existing app environment, and the uploads mount. Never embed mail credentials in the image. Missing SMTP configuration or mail failure blocks registration without creating an account; there is no production test-code fallback.

Customer email edits are disabled until a separate verified email-change flow is implemented. Staff login does not use student signup OTP. Existing accounts are not retroactively verified. Gmail sending limits and deliverability apply; monitor bounces and move to a dedicated email service if campus demand exceeds the sender limits. The OTP test suite captures messages only under NODE_ENV=test and never sends real mail.


OTP release `852d2f6` is deployed as `campuscart:otp-20261028` (also tagged `campuscart:release`), built from `/srv/campuscart/releases/otp-20261028`. A pre-release MongoDB backup is retained at `/srv/campuscart/private/backups/pre-otp-20261028.archive.gz`; the previous app container is stopped as `campuscart-app-pre-otp` for rollback. No existing users, products or orders were replaced.

Validation: production build and all 25 tests passed with no skips, including OTP concurrency across two HTTP servers, expiry, wrong-code limits, resend limits, replay, SMTP failure and existing checkout recovery. The live HTTPS page shows the mobile OTP signup flow; direct signup without OTP and non-college email requests are rejected. Both campus shopkeepers still log in and see only their own delivery groups. Google Cloud SMTP authentication succeeded and Gmail accepted a deployment-check email addressed only to the configured sender mailbox. A student's real college inbox was not inspected; successful OTP/account creation was exercised against the isolated test mailbox, not by bypassing verification in production.

Existing customers can now use Profile > College email verification. Authenticated POST `/api/users/profile/verification-code` sends only to the signed-in account email; POST `/api/users/profile/verify-email` consumes an account-bound OTP and updates only `emailVerifiedAt`. Account IDs, passwords, roles and orders are retained. Signup and existing-account challenges cannot be interchanged. Existing sign-in continues to work before verification.

Existing-account verification release `52e6f23` is live as `campuscart:profile-otp-20261028` (also tagged `campuscart:release`), with backup `pre-profile-otp-20261028.archive.gz` and rollback container `campuscart-app-pre-profile-otp`. All 25 tests passed, including preservation of an existing customer password, identity and complete order documents after OTP verification. Live endpoints reject unauthenticated requests; the deployed mobile profile flow passed with mocked verification responses. The real 24bec018 customer account and its existing order had identical before/after fingerprints; the account remains unverified until its owner enters a fresh profile OTP. No real account was marked verified by the tests.
