export const runtime = "nodejs";

export async function POST() {
  return Response.json({ error: "Stripe billing portal is scaffolded only. Enable after auth and server-side Stripe secrets are configured." }, { status: 501 });
}
