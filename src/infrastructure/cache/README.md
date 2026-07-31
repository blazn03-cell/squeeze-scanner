# Cache layer

Use Redis for current quotes, provider rate-limit counters, scan locks, and temporary scan results.

On Vercel, Vercel KV is no longer first-party; existing stores were migrated to Upstash Redis through the Vercel Marketplace in December 2024. Use Upstash Redis or another Redis provider through the Marketplace.
