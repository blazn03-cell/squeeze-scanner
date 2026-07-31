export const runtime = "nodejs";

export async function POST() {
  return Response.json({ error: "Stripe Checkout is scaffolded only. Enable after products, prices, auth, and server-side Stripe secrets are configured." }, { status: 501 });
}
