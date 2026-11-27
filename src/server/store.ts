import { createClient } from "@supabase/supabase-js";
import type { GameRow, Lobby, Store } from "./games";

export class MemoryStore implements Store {
  rows = new Map<string, GameRow>();
  async create(lobby: Lobby) {
    const id = crypto.randomUUID();
    this.rows.set(id, { id, lobby, state: null, version: 0 });
    return id;
  }
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async save(row: GameRow) {
    const cur = this.rows.get(row.id);
    if (!cur || cur.version !== row.version - 1) return false;
    this.rows.set(row.id, structuredClone(row));
    return true;
  }
}

// names differ between manual setup and the Vercel–Supabase integration (legacy vs new keys)
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const DB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

class SupabaseStore implements Store {
  db = createClient(DB_URL!, DB_KEY!, {
    auth: { persistSession: false },
  });

  async create(lobby: Lobby) {
    const { data, error } = await this.db.from("games").insert({ lobby }).select("id").single();
    if (error) throw error;
    await this.bump(data.id, 0);
    return data.id as string;
  }

  async get(id: string) {
    const { data, error } = await this.db.from("games").select("id, lobby, state, version").eq("id", id).maybeSingle();
    if (error && error.code !== "22P02") throw error; // 22P02 = not a uuid
    return (data as GameRow) ?? null;
  }

  async save(row: GameRow) {
    const { data, error } = await this.db
      .from("games")
      .update({ lobby: row.lobby, state: row.state, version: row.version })
      .eq("id", row.id)
      .eq("version", row.version - 1)
      .select("id");
    if (error) throw error;
    if (!data.length) return false;
    await this.bump(row.id, row.version);
    return true;
  }

  // game_versions is public-readable and in the realtime publication; clients refetch when it changes
  private async bump(id: string, version: number) {
    const { error } = await this.db.from("game_versions").upsert({ game_id: id, version });
    if (error) throw error;
  }
}

// kept on globalThis: in dev every route is a separate module instance and would get its own memory store
const g = globalThis as { fabrykantStore?: Store };

export function getStore(): Store {
  if (g.fabrykantStore) return g.fabrykantStore;
  let store: Store;
  if (DB_URL && DB_KEY) store = new SupabaseStore();
  else if (process.env.NODE_ENV !== "production") store = new MemoryStore(); // shortcut: local dev only, lost on restart
  else throw new Error("Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  return (g.fabrykantStore = store);
}
