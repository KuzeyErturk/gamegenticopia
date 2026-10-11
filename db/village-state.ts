import { env } from "cloudflare:workers";

const createVillageStateTable = `
  CREATE TABLE IF NOT EXISTS village_states (
    user_id TEXT PRIMARY KEY NOT NULL,
    snapshot TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

export async function readVillageState(userId: string) {
  await ensureVillageStateTable();
  const row = await env.DB.prepare(
    "SELECT snapshot, updated_at FROM village_states WHERE user_id = ? LIMIT 1",
  ).bind(userId).first<{ snapshot: string; updated_at: number }>();
  if (!row) return null;
  return { state: JSON.parse(row.snapshot), updatedAt: row.updated_at };
}

export async function writeVillageState(userId: string, snapshot: unknown) {
  await ensureVillageStateTable();
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > 250_000) throw new Error("Village snapshot is too large");
  const updatedAt = Date.now();
  await env.DB.prepare(`
    INSERT INTO village_states (user_id, snapshot, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      snapshot = excluded.snapshot,
      updated_at = excluded.updated_at
  `).bind(userId, serialized, updatedAt).run();
  return updatedAt;
}

async function ensureVillageStateTable() {
  await env.DB.prepare(createVillageStateTable).run();
}
