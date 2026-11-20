# Authentication and billing integration

## Authentication
- `POST /api/auth/login` accepts email/password and delegates credential verification to Supabase Auth.
- `POST /api/auth/logout` clears the HttpOnly access and refresh cookies.
- `GET /api/auth/me` validates/refreshes the session and returns the authenticated user plus fail-closed subscription entitlements.
- Tokens are never returned in JSON or stored in browser-readable storage. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.

## Stripe subscriptions
- `POST /api/billing/checkout` requires an authenticated user and accepts only `pro` or `ultra`. Stripe Price IDs come from `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ULTRA`.
- `POST /api/billing/webhook` verifies the raw-body Stripe signature with a timestamp tolerance, claims event IDs in the append-only service-role ledger, and upserts subscription state on subscription lifecycle events.
- Apply `0007_stripe_webhook_events.sql` after `0006_research_snapshots.sql` and the initial schema. The service-role key is used only server-side; the event ledger has RLS enabled and no client policies.

## Required configuration
Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ULTRA` and `NEXT_PUBLIC_APP_URL`. Configure the Stripe webhook endpoint for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

The checkout route does not invent prices or product IDs. Authentication and billing are not live until valid Supabase/Stripe credentials, products, webhook configuration and database migrations are provisioned. Configure provider-side rate limits and monitoring before production use. Email verification, OAuth/SSO, customer portal, tax handling, refunds, proration policy and dunning remain future integrations.
