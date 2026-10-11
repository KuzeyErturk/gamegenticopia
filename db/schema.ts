import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const villageStates = sqliteTable("village_states", {
  userId: text("user_id").primaryKey(),
  snapshot: text("snapshot").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
