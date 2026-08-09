import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { discoverServices } from "@/features/services/server/discover";
import { checkServices } from "@/features/services/server/health";

export const dynamic = "force-dynamic";

/**
 * JSON view of the portal, for scripting against.
 *
 * The session is re-checked here rather than relying on `src/proxy.ts`: route
 * handlers are their own entry point, and this response carries internal
 * hostnames.
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apps = await discoverServices();
  const health = await checkServices(apps);

  return NextResponse.json(
    {
      services: apps.map((app) => ({
        id: app.id,
        name: app.name,
        host: app.host,
        url: app.url,
        category: app.category,
        health: health[app.id] ?? { state: "unknown", checkedAt: new Date().toISOString() }
      }))
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
