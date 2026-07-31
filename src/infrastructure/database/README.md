# Database layer

Use PostgreSQL for users, plans, watchlists, alerts, scan snapshots, and audit records. If Supabase exposes user tables, enable row-level security on every exposed table before launch.

Required tables for the paid product:

- profiles
- subscriptions
- symbols
- watchlists
- watchlist_symbols
- scan_runs
- scan_results
- alert_rules
- alert_events
- provider_health
- audit_events

On Vercel, Vercel Postgres is no longer first-party; existing databases were migrated to Neon through the Vercel Marketplace in December 2024. Use Neon or another PostgreSQL provider through the Marketplace.
