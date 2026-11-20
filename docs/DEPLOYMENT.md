# Vercel Deployment

1. Sign in to Vercel and choose **Add New → Project**.
2. Import `reakneel/silverscope` from GitHub.
3. Framework preset: Next.js. Root directory: `./`.
4. Build command: `npm run build` (or leave Vercel default).
5. No environment variables are required for the current UI-only scaffold.
6. Deploy. Verify Overview, Signals, Indicators and Pricing routes.
7. Keep production branch set to `main`; subsequent pushes trigger deployments.

When Supabase and Stripe are implemented, configure their production secrets in Vercel Project Settings → Environment Variables. Never commit `.env.local` or service-role/payment secrets.
