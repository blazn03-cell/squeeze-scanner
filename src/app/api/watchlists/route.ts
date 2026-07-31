export const runtime = "nodejs";

export async function GET() {
  return Response.json({ error: "Watchlists API is scaffolded only. Add auth, ownership checks, and database persistence before enabling." }, { status: 501 });
}
