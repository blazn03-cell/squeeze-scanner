# Billing layer

Stripe subscriptions must be controlled by verified, idempotent webhooks. The checkout-success page may show a confirmation, but it must not grant access.

Minimum webhook behavior:

- Verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`.
- Store processed event IDs to make handling idempotent.
- Update `subscriptions` from authoritative Stripe events.
- Audit plan/status changes.
- Keep `STRIPE_SECRET_KEY` server-side only.
