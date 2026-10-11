import { headers } from "next/headers";
import { readVillageState, writeVillageState } from "../../../db/village-state";

export const dynamic = "force-dynamic";

async function currentVillageOwner() {
  const requestHeaders = await headers();
  return requestHeaders.get("oai-authenticated-user-id") ?? "local-demo-owner";
}

export async function GET() {
  try {
    const result = await readVillageState(await currentVillageOwner());
    return Response.json(result ?? { state: null, updatedAt: null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load village" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "Expected JSON" }, { status: 415 });
    }
    const payload = await request.json() as { state?: unknown };
    if (!payload.state || typeof payload.state !== "object") {
      return Response.json({ error: "Missing village state" }, { status: 400 });
    }
    const version = (payload.state as { version?: unknown }).version;
    if (version !== 2) return Response.json({ error: "Unsupported village version" }, { status: 400 });
    const updatedAt = await writeVillageState(await currentVillageOwner(), payload.state);
    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save village" }, { status: 500 });
  }
}
