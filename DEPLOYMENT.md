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

This handover does not claim email ownership verification or automatic bank deductions: signup validates the `@nith.ac.in` domain only, and late penalties are ledger entries. Automated off-VM backups, online payments and a custom purchased domain are not configured. Menu stock and representative product photographs should be reviewed by the shops before accepting real student orders.


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
