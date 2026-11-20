# Supabase setup

## Apply the schema
1. Create a Supabase project for the intended environment.
2. Install the Supabase CLI and authenticate locally.
3. Link the project with: supabase link --project-ref PROJECT_REF.
4. Apply migrations with: supabase db push.
5. Verify RLS policies and the auth-user profile trigger in a non-production environment first.

Migrations in supabase/migrations create profiles, source registry, ingestion runs, immutable observations, indicators, model versions, score snapshots, signals, subscriptions, alerts and audit events.

## Environment variables
Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. The service-role key is server only; never use a NEXT_PUBLIC_ prefix. Configure FRED_API_KEY and CRON_SECRET to activate the protected macro ingestion endpoint.

The application health route reports whether required variables are present. It does not validate credentials or claim that database connectivity works.

## Security model
Browser-facing authenticated users can read their own profile, source and indicator catalogues, published score/signal snapshots, and their own subscription/alerts. Ingestion and financial writes are server-side only. Do not expose service-role credentials. Admin role assignment must be performed through a trusted server-side process, not by allowing users to update their own profile role.

The cron endpoint requires Authorization: Bearer CRON_SECRET and uses the service-role key only on the server. Keep the endpoint secret out of query strings and client-side bundles.
