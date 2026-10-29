# Campus features on the existing MERN stack

This release keeps MongoDB/Mongoose, Express, React/Vite and Node. It adds no SQL, Supabase, TypeScript migration or separate application. Existing COD checkout, accounts, orders, stock reservation recovery, role permissions and notification subscriptions remain supported.

## Screens

- Students: `/rider` (apply with verified college email and UPI ID, availability, offers, pickup, delivery code and weekly earnings).
- Administrators / Super Administrator: `/admin/riders` and `/admin/coupons`.
- Shopkeepers: `/admin/settings` for their own hours, preparation/walk time and print rates. Administrators may manage shop settings too. Existing delivery fees and late penalties remain Super Administrator-only.
- Checkout: coupon code, shopkeeper/student-rider delivery, and a delivery slot in campus time (IST).
- Order history: rider identity, pickup token, scheduled/cancelled states, student-only delivery code and a seven-day order-rating form.
- Storefront: account favourites, Buy again, averages after three order ratings, and Notify me for sold-out items.

## Operational behaviour

Riders remain customer accounts and do not gain staff access. Offers omit student identity/address and codes; assigned riders can see delivery details but never the code. An atomic rider slot reservation limits concurrent holdings to two; unique reservation tokens fence late cleanup/returns. A delivery task has exactly one rider, requires shop-ready status for pickup, and requires the student code plus COD-collected confirmation for delivery. Interrupted delivery completion is reconciled by the worker.

Admins set the rider reward at approval (default zero; choose the intended amount). Weekly earnings use Monday-to-Monday IST. Preparing a completed week's payout is idempotent; each delivered task belongs to only one payout. Recording a UPI reference does not send money.

Coupon pricing and limits are enforced inside order creation, never trusted from the browser. Reservations participate in the existing checkout recovery record. Failed orders restore stock and release their coupon reservation. Committed/retried orders retain one redemption. Discounts apply only to eligible item subtotals, never delivery charges, and cannot exceed that subtotal.

Scheduled slots are five-minute boundaries within 48 hours and allow preparation plus travel time. The client and backend import the same `shared/fulfillment.js` rules. The backend releases shop orders at the slot minus preparation/walk time and issues a pickup token for the release date in IST. A shop that is closed at release causes a reasoned cancellation and idempotent stock restoration; its COD amount is removed. A temporary closure does not prevent booking future opening-hour slots. Reopen before preparation is due. A release missed by more than 15 minutes after the delivery slot is cancelled. The durable worker checks every 15 seconds. Immediate orders remain supported.

## Print Store — backend only

As requested, this is the private storage/pricing/order foundation, not a student print-store UI.

- `POST /api/print/jobs`: authenticated student multipart PDF upload (`file`, `shopkeeper`, `copies`, `colour`). Maximum 10 MB / 500 pages / 100 copies; encrypted or malformed PDFs are rejected. Only Node's PDF parser counts pages and computes the product price from saved shop rates. Client price/page fields are ignored.
- File bytes live in private MongoDB GridFS (`privatePrintFiles`), not public `/uploads`.
- The response supplies a private product ID for the ordinary COD order API. Private print products are excluded from catalogue, recommendations and Buy again, and only the uploading student can order them.
- `GET /api/print/jobs` and `GET /api/print/jobs/:id/file`: only the owning shopkeeper, after that shop's order is released. The uploader, administrators and other shops cannot download the file through the application.
- Existing MongoDB backups include print storage. Uploads are limited to ten per account per hour.

## Verification

The complete regression run passed 31 tests without skips, including existing checkout/process-crash/multi-backend recovery tests. Final payout and scheduling refinements were rechecked in the new integration suite; the production build passes. Tests use an isolated localhost database, not production orders or stock.

The new suite verifies simultaneous rider acceptance, two-order capacity, ready-only pickup, pre-pickup return, wrong-rider/wrong-code denial, idempotent delivery, coupon races/rollback/limits, scheduled release and cancellation stock restoration, rating ownership/window/threshold, restock alerts, account favourites, weekly payout deduplication and PDF pricing/download isolation. Slot rules are checked at every five-minute interval across two days against an independent IST-hours calculation.
