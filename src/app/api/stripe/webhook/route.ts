export const runtime = "nodejs";

export async function POST() {
  return Response.json({ error: "Stripe webhook is scaffolded only. Verify signatures and process events idempotently before enabling subscriptions." }, { status: 501 });
}
