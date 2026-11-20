# Authentication and billing integration

## Authentication
- `POST /api/auth/login` accepts email/password and delegates credential verification to Supabase Auth.
- `POST /api/auth/logout` clears the HttpOnly access and refresh cookies.
- `GET /api/auth/me` validates/refreshes the session and returns the authenticated user plus fail-closed subscription entitlements.
- Tokens are never returned in JSON or stored in browser-readable storage. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.

## Stripe subscriptions
- `POST /api/billing/checkout` requires an authenticated user and accepts only `pro` or `ultra`. Stripe Price IDs come from `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ULTRA`.
- `POST /api/billing/portal` creates an authenticated Stripe customer-portal session for the user's stored Stripe customer.
- `POST /api/billing/webhook` verifies the raw-body Stripe signature with a timestamp tolerance, claims event IDs in the append-only service-role ledger, and upserts subscription state on subscription lifecycle events.
- Apply `0007_stripe_webhook_events.sql` after `0006_research_snapshots.sql` and the initial schema. The service-role key is used only server-side; the event ledger has RLS enabled and no client policies.

## Required configuration
Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ULTRA`, `STRIPE_PRICE_PRO_DISPLAY`, `STRIPE_PRICE_ULTRA_DISPLAY` and `NEXT_PUBLIC_APP_URL`. The display labels must exactly match the configured Stripe recurring prices. Configure the Stripe webhook endpoint for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

The checkout route does not invent prices or product IDs. Authentication and billing are not live until valid Supabase/Stripe credentials, products, webhook configuration and database migrations are provisioned. Configure provider-side rate limits and monitoring before production use. Email verification, OAuth/SSO, customer portal, tax handling, refunds, proration policy and dunning remain future integrations.


## Protected research resources
- `GET/POST /api/alerts` requires an authenticated Pro or Ultra user. Alert reads/writes use the caller's Supabase access token so the `alerts` table RLS policy enforces ownership. Plan quotas are 10 alerts for Pro and 50 for Ultra.
- `DELETE /api/alerts/:id` is owner-scoped by Supabase RLS.
- `GET/POST /api/research/runs` requires Ultra. The server queries only verified observations whose observed, published and fetched timestamps are no later than the requested decision time, builds the canonical snapshot on the server, and persists it with the authenticated user's owner ID. Client-submitted observation rows are never accepted as verified evidence.

Dashboard demo pages remain public. Any future account-specific dashboard route must use the same server-side user and entitlement checks before exposing user-owned data.
