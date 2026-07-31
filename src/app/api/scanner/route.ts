// Placeholder for the production Next.js route.
// This route should authenticate the user, validate input with schemas, and enqueue
// a bounded scan job. Do not call live market-data providers directly from browser code.
export const runtime = "nodejs";

export async function POST() {
  return Response.json({ error: "Scanner API is scaffolded only. Wire this after auth, storage, and job queue are installed." }, { status: 501 });
}
