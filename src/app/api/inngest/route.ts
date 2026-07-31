export const runtime = "nodejs";

export async function GET() {
  return Response.json({ status: "scaffolded", message: "Install Inngest and serve functions here after the scan job contract is finalized." }, { status: 501 });
}
