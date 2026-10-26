# Internet deployment handoff

Status: deployment preparation only. No hosting account, cloud database or public URL has been provisioned.

The repository contains a production Docker image definition and `/api/health` readiness endpoint. Secrets are excluded from the image context. Docker is not installed in the current workspace, so the image itself has not been built here.

## Services needed

1. A Node/Express-capable host, with HTTPS and one public origin serving both frontend and API. Build: `npm ci && npm ci --prefix frontend && npm run build`. Start: `npm start`. Set health check `/api/health`.
2. A MongoDB database reachable from that host. The laptop's `127.0.0.1` database cannot be used by a remote host.
3. Durable product-photo storage. Repository menu photos ship with the app, but later uploads currently go to `uploads/`. Ephemeral hosts need external storage or a persistent disk. Mounting an empty disk over `uploads/` hides bundled photos; copy them onto the disk before serving it.
4. Runtime environment: `NODE_ENV=production`, `MONGO_URI`, a newly generated private `JWT_SECRET`, and the hosting provider's `PORT`. HTTPS is required for production login cookies. Never commit credentials or paste them into project documentation.

## Important current hosting constraint

The tested checkout recovery implementation supports processes in the same OS PID namespace. It intentionally does not reclaim reservations from an unknown host. Container replacement and multi-host platforms cannot yet guarantee automatic checkout recovery after a crash. Before enabling public orders on Render/Railway or another container platform, adapt checkout to MongoDB replica-set transactions and test crash/retry behavior there. A Dockerfile alone does not remove this requirement.

For a persistent single-machine deployment using ordinary Node processes, retain the host identity and PID namespace, run a single service manager, and restart the backend on that same machine. Do not scale to multiple machines with the current recovery implementation.

## Provider choice

- Free Render sleeps after inactivity and does not persist uploaded files. It needs cloud photo storage and the checkout change described above before taking real orders.
- Paid hosting with a persistent disk avoids losing uploads, but container/PID replacement still needs the checkout change.
- A persistent Linux VM with MongoDB and uploads on durable disk can retain the currently tested same-host recovery model. It needs server administration, HTTPS and backups.

Official references: https://render.com/docs/free and https://render.com/docs/disks

## Account and migration steps

The owner must sign into their chosen hosting and database accounts directly. Do not send passwords in chat. Confirm the hosting plan before creating billable resources.

Before publishing an existing database, replace shared demo/staff passwords and disable unneeded demo accounts. Preserve customer/order ownership; do not copy orders between users. Back up the original database and uploads, then migrate to a separate cloud target and verify counts. Do not run the destructive old seeder.

Final acceptance on the actual HTTPS domain: registration/login, upload followed by restart, per-shop checkout, customer-only history, seller delivery, SA deductions, stock contention, retry after connection loss, and restart recovery. Until these checks pass, the project has not been verified as a live service.
