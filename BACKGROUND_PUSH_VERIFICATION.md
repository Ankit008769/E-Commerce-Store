# Background push verification — 28 October 2026

Existing test order: `6ae1e2f0de412e42f0b54b15` (Booth 4, INR 70).
No new order was created during this retry. No stock, delivery, or payment state was changed.

Chrome received the retry at 16:46:54.555 UTC with zero CampusCart window clients. The authenticated profile check returned 200 and showNotification resolved at 16:46:54.854 UTC. The user confirmed seeing the alert. Earlier server acceptance alone did not establish desktop visibility, and the cause of the originally missed popup was not captured.

The service worker now records the latest per-shop delivery outcome locally, distinguishes sign-in/account failures from display errors, bounds the profile request to 10 seconds, and uses renotify only for an explicit retry of the same notification tag. The diagnostic page is `/notification-check.html`; it checks the current shopkeeper before displaying the local result. It is not an order creation or notification-send endpoint.

Three service-worker regression tests pass: closed-tab same-order retry, other-account isolation, and expired-session handling. The database-backed notification suite was skipped when run without its test database; it is not counted as a passing test in this verification.

Deployment: `campuscart:push-diagnostics-20261028`, a static overlay on `campuscart:alerts-20261028`. Source for the overlay is retained in `/srv/campuscart/releases/push-diagnostics-20261028`; the ordinary project Dockerfile also includes these public files in a full rebuild. Previous container retained as `campuscart-app-pre-push-fix`.
