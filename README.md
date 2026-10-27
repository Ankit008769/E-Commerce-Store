# CampusCart — college marketplace

This updates the existing MERN store; it is not a separate project. Customer and management portals share the backend and have separate navigation and sign-in screens.

## Start

Use Node.js 22.12+ (tested with Node 24) and a running local MongoDB. Keep your existing `.env`, uploaded photos and database when updating this project.

For a fresh clone, run from the project root:

```powershell
npm ci
npm ci --prefix frontend
Copy-Item example-env.env .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the generated secret in `.env` as `JWT_SECRET` and set `MONGO_URI` to your database. Copy the example only on a fresh setup; do not overwrite an existing `.env`. Then run:

```powershell
npm run dev
```

Customer portal: http://localhost:5173/ · Staff login: http://localhost:5173/admin/login · Backend: http://127.0.0.1:5010/. The Vite development proxy targets port 5010; update `frontend/vite.config.js` if you deliberately change the backend port.

To run the built application without Vite:

```powershell
npm run build
npm start
```

Open http://localhost:5010/. Express serves the frontend and supports direct links. For an internet deployment, provide HTTPS, set `NODE_ENV=production` (secure cookies require HTTPS), and persist MongoDB plus `uploads/`. The current Google Cloud deployment and operating notes are in [DEPLOYMENT.md](DEPLOYMENT.md). Email ownership verification is not configured; signup checks the email domain only.

## First Super Administrator

Register a customer account with your official `@nith.ac.in` email, then run this command from the project root:

```powershell
npm run superadmin -- your-email@nith.ac.in
```

Sign out and sign back in at `/admin/login`. This is an explicit, local promotion command; public registration always creates a customer. Existing `isAdmin` accounts retain Administrator access and are not silently promoted.

## Access

| Role | Access |
| --- | --- |
| Customer | Browse active shops, saved products, own cart/orders/profile, COD checkout |
| Shopkeeper | Own products, photos, stock and orders; confirm own delivery and cash collection |
| Administrator | Catalogue management and order overview; assign existing products to active shops |
| Super Administrator | All management views, create staff/shopkeepers, blacklist/reactivate/remove accounts, per-shop delivery policies and deduction ledger |

Only the Super Administrator can read or change delivery responsibility settings and deductions. Other roles can see customer-facing charges and delivery deadlines. APIs enforce these permissions, not just navigation.

## Setup your shops

In **People & shops**, add Shopkeeper and Administrator accounts. In **Delivery & deductions**, set each shop's free-delivery minimum, delivery charge below that minimum, time limit and fixed late deduction. Initial defaults are ₹500, ₹30, 60 minutes and ₹0; configure them before accepting orders.

Existing products without a shopkeeper remain in management but are hidden from the storefront. Edit them in **Products** to assign an active shop. Do not rerun the old `seed.js` against your real database: it deletes existing categories and products.

Product photos and positive prices are required. Product names and descriptions are optional. Stock defaults to one. Camera capture uses the device file picker on compatible devices; desktop users can upload a photo. Uploaded files must be JPG/PNG/WebP, up to 5 MB.

## Customer shopping and separate portals

Customers can browse every shop or use the optional Choose shop filter. The cart and checkout show a bill section for each shop plus a combined grand total. Each shop delivers independently and collects its own COD amount. Customer sign-in is `/login`; shopkeepers, administrators and super administrators use the separate `/admin/login` portal.

## Orders and delivery

- COD is the only accepted method; the old online-payment endpoint is disabled.
- A checkout creates one order with a separate delivery group per shop. Each group's minimum and fee are calculated independently from database prices. No extra tax is added in this college version.
- Stock changes and reservation markers are written atomically on each product. A failed checkout restores its reservations. Before listening for requests, startup recovery restores reservations whose order was never saved, or finalizes reservations for an existing order. Repeating recovery is safe, including after a crash during recovery. Checkout IDs persist so retries reuse the saved order.
- Multiple backend processes on the same machine and OS process namespace are supported. Checkout records identify their owning worker; recovery skips live processes and atomically claims work only after the OS confirms the owner has stopped. Reservation generations prevent stale recovery from affecting a newer retry. Workers must share MongoDB and JWT_SECRET and use different listening ports.
- Automatic crash recovery across different machines or separate container PID namespaces is not supported. Unknown, remote, or ambiguous worker ownership fails closed (stock is not restored). Use MongoDB transactions on a replica set or a distributed recovery coordinator before deploying across hosts. Stop all old-version workers before upgrading; pending legacy records without ownership need operator review.
- The timer starts when the order is placed. The deadline and penalty are snapshotted, so policy edits do not change existing orders.
- The shopkeeper confirms both delivery and COD collection. Completing the same delivery twice does not duplicate the deduction. The full order becomes delivered/paid once every shop completes its delivery.
- A late delivery receives one fixed penalty, not a per-minute penalty. The SA ledger shows pending overdue amounts and finalized deductions. These are accounting records for later settlement; COD does not automatically transfer or deduct bank funds.
- Blacklisted/removed accounts cannot sign in or use existing sessions; their products cannot be newly ordered. Their historical orders remain. Pending deliveries from these shops require the SA to reactivate the shop to allow completion; there is no reassignment/refund workflow in this version.
- Historical orders are retained without retroactive deadlines or deductions.

## Checks

`npm test` runs boundary, role and privacy tests. API integration tests run only when `MARKETPLACE_TEST_URI` points to a disposable database whose name starts with `campuscart_test`. Never point them at your real store database.

Run the build and full integration suite together (MongoDB must be running):

```powershell
$env:MARKETPLACE_TEST_URI='mongodb://127.0.0.1:27017/campuscart_test_final'
npm run verify
```

Without that environment variable, integration tests are skipped; a unit-only pass is not the full verification.




## Import Booth 4 and 4H menus

Copy `example-env.env` to `.env`, configure MongoDB and a random JWT secret, install root/frontend dependencies, then run from the project root:

```powershell
node backend/utils/importCampusMenus.js ../campus-shop-accounts.json
```

This creates Booth 4 and 4H shopkeeper accounts and imports 108 and 58 menu variants respectively. The credentials file is private: keep it outside Git. Importing again does not duplicate products or reset stock/passwords. Initial stock is 100 test servings; verify inventory and configure delivery policies before taking real orders. Existing MongoDB users and orders are not stored in this repository.

Food photos under `uploads/menu-food` are representative, not shop-supplied. Original sources, authors and licenses are recorded in `backend/data/menus/food-photo-credits.json` and product descriptions. `product-photos.json` preserves the item-to-photo mapping for repeat imports.

New public customer registration requires an exact `@nith.ac.in` email domain (case-insensitive). Changing a customer email uses the same rule. Existing accounts continue to sign in; staff creation remains Super Admin controlled. This is a domain check only, not email ownership verification. Super Admin can search orders by customer, email, product, shop or order ID.
`node backend/utils/migrate4HCategories.mjs` updates an existing local 4H catalogue from the old Rate List category to food categories. Fresh imports use the updated menu CSV automatically.

Campus delivery locations are shared by the header picker and checkout. The searchable catalogue includes 61 named hostels/buildings/areas, based on NITH hostel and Planning & Works pages (source URLs are stored with each entry), plus user-confirmed shop names. It is not an exhaustive live campus directory. Room/block/meeting-point details and a custom-address option cover missing locations. Category navigation stays in one scrollable row with previous/next buttons.


## Demo and handover

- Customer: register/sign in, choose a campus location, browse Booth 4 or 4H, add items, review per-shop bills, and place COD checkout. My orders contains only the signed-in customer’s orders.
- Shopkeeper: use `/admin/login`. The logo opens Overview; View my shop shows that seller’s catalogue. Add product accepts a photo, required price and stock; names are optional. My deliveries shows only that shop’s order items. Confirm delivery only after delivery and COD collection (or an explicitly labelled test).
- Administrator: manage products and inspect orders; cannot manage accounts or delivery policies.
- Super Administrator: filter accounts by role, manage administrators/shopkeepers, configure delivery policies, and inspect the deduction ledger. Super Administrator accounts cannot be removed through account management.
- Browser tabs on the same origin share one login. The app reconciles session changes across tabs. Use separate browser profiles/incognito windows to demonstrate different roles side by side.
- Local demo passwords are deliberately excluded from Git. Create/reset accounts locally; the database is not bundled with the repository.
- Back up MongoDB and `uploads/` before replacing a machine or changing real catalogue data. Keep secrets outside version control. Do not run destructive legacy seeding scripts against the existing database.

### Final verification — 27 October 2026

The full suite covers permissions, customer order isolation, independent shop fees and deliveries, blacklisting, stock contention, duplicate checkout/retry, rollback, crash recovery and two backend processes on the same host. Browser checks cover staff role filters, both shopkeeper product forms, mobile navigation, account switching, and the customer-to-shopkeeper COD flow.

The explicitly labelled local Booth 4 test order `6adfb6827db56756959b911e` was placed for one Aloo Tikki Burger (₹40 + ₹30 delivery) and marked delivered as a test. Customer history and shopkeeper deliveries both reflect completion. No physical delivery or actual cash collection was performed by this test.

## Live website

[CampusCart storefront](https://campuscart.34.93.237.251.sslip.io/) · [Staff sign-in](https://campuscart.34.93.237.251.sslip.io/admin/login). See [deployment details](DEPLOYMENT.md) for the Google Cloud project, persistent storage, verification and billing notes. Local and online databases are independent.
