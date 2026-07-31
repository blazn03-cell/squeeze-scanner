export const runtime = "nodejs";

export async function GET() {
  return Response.json({ error: "Alerts API is scaffolded only. Add auth, ownership checks, schema validation, and delivery persistence before enabling." }, { status: 501 });
}
