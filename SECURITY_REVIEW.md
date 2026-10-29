# CampusCart security review — 29 October 2026

This is a source review, dependency audit and targeted regression exercise, not a guarantee against all attacks or an independent penetration test.

## Implemented protections
- Patched production dependency locks. Backend and frontend `npm audit --omit=dev` each report zero known advisories at review time. React Router moved to the patched 7.18.5 release; React/MongoDB/Express/Node stack preserved.
- Helmet CSP: scripts from this origin, no plugins, no framing, restricted base/form targets, nosniff, HSTS in production, and private no-store API responses. Inline styles remain allowed for existing React/ALTCHA styling; external HTTPS images remain supported.
- Cross-origin mutations rejected using Origin/Referer/Fetch Metadata checks. Strict HttpOnly cookies retained. Non-browser clients without browser-origin headers still require normal authorization.
- 64 KB JSON limit, multipart field/file limits, nesting and operator/prototype-key validation, bounded product/review/profile fields. Unexpected errors no longer disclose internal messages.
- Per-process API flood limiter (1,800 requests/minute/IP). Mongo-backed CAPTCHA, login and profile/upload limits persist across processes. Login limits are 20/hour/email and 100/hour/IP after CAPTCHA; quotas can affect users sharing a campus IP.
- Password/email changes require current password. Password change invalidates previous account sessions. Logout revokes that exact token in MongoDB. New JWTs are unique, expire after seven days, and verification accepts only HS256. Existing sessions continue until expiry/revocation unless a credential changes.
- Photo uploads decode and re-encode to WebP, strip original metadata/trailing payloads, reject active formats/animation, cap input at 5 MB/16 MP and output dimensions at 2,400 px. Public upload serving permits passive image extensions only.
- Product multipart requests accept fields only; photo upload has its own authenticated, rate-limited route. Private print files retain shop-only access; PDF scripts/launch actions/attachments and excessively complex object graphs are rejected.
- Login return URLs are restricted to customer routes, including rejection of backslash/protocol-relative redirects.
- Backend binds to loopback by default behind Caddy; request/header timeouts and strong production JWT-secret minimum enforced.

## Validation
The 37-test complete regression run passed. The subsequent active-PDF fixture and updated security suite passed; ordinary print creation and all campus-feature integration checks also passed. Production frontend build passed.
Checks include CSRF, NoSQL/prototype keys, oversized input, error redaction, role isolation, password proof, old-token/logout revocation, JWT algorithms, forged photos, real image rewriting, unsafe redirects, stock races, checkout idempotency and restart recovery. Intrusive tests ran against isolated localhost MongoDB only.

## Required operational follow-up and limits
1. The Gmail App Password previously shared in chat must be revoked/replaced through the owner's Google account. It was not copied into Git or this report. Do not paste the replacement in chat. Email OTP content remains visible to the trusted SMTP sender/provider; a separate Gmail does not remove this trust. College Google Sign-In remains a separate pending choice.
2. Keep dependencies, Node/Docker, VM OS and MongoDB patched. Zero current advisories does not mean no undiscovered vulnerabilities.
3. The application limiter is not upstream DDoS protection; volumetric attack mitigation, independent penetration testing, alerting and off-host backup/restore drills remain operational work.
4. PDF checks are not an antivirus sandbox and do not guarantee protection against malicious parser exploits. Use a scanning/isolation service before opening unrestricted public uploads at scale.
5. Existing uploaded files were not bulk rewritten, and existing user passwords were not reset. Production records and order history were preserved.

Configuration: set PUBLIC_ORIGIN to the exact trusted HTTPS origin when changing domains. HOST defaults to 127.0.0.1; expose traffic through the reverse proxy. Keep JWT/SMTP/VAPID/database secrets outside source control. Do not relax CSP or origin checks globally to fix an integration; add only the required trusted origins after review.
