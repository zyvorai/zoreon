/**
 * Realtime fan-out for Zoreon clients (SSE).
 * Local in-process hub + optional Postgres LISTEN/NOTIFY for multi-replica.
 */
import { dbSource } from "@/lib/db";

export type ZoreonEvent =
  | { type: "typing"; channelId: string; userId: string; userName: string; at: number }
  | { type: "refresh"; reason: string; channelId?: string; at: number; preview?: string }
  | {
      type: "huddle";
      channelId: string;
      participants: { id: string; name: string }[];
      at: number;
    }
  | { type: "ping"; at: number };

type Client = {
  id: string;
  email: string | null;
  send: (ev: ZoreonEvent) => void;
};

const CHANNEL = "zoreon_realtime";

const globalRef = globalThis as typeof globalThis & {
  __zoreonHub__?: {
    clients: Map<string, Client>;
    listenStarted?: boolean;
    listenPromise?: Promise<void>;
  };
};

function hub() {
  globalRef.__zoreonHub__ ??= { clients: new Map() };
  return globalRef.__zoreonHub__;
}

function localBroadcast(ev: ZoreonEvent, exceptId?: string) {
  const h = hub();
  for (const [id, c] of h.clients) {
    if (exceptId && id === exceptId) continue;
    try {
      c.send(ev);
    } catch {
      h.clients.delete(id);
    }
  }
}

async function ensurePgListener() {
  if (dbSource !== "neon") return;
  const h = hub();
  if (h.listenStarted) return;
  h.listenStarted = true;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;

  h.listenPromise = (async () => {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: url });
      await client.connect();
      client.on("notification", (msg) => {
        if (msg.channel !== CHANNEL || !msg.payload) return;
        try {
          const ev = JSON.parse(msg.payload) as ZoreonEvent;
          localBroadcast(ev);
        } catch {
          /* ignore */
        }
      });
      client.on("error", () => {
        h.listenStarted = false;
      });
      await client.query(`LISTEN ${CHANNEL}`);
    } catch {
      h.listenStarted = false;
    }
  })();
  await h.listenPromise;
}

export function subscribeRealtime(input: {
  id: string;
  email: string | null;
  send: (ev: ZoreonEvent) => void;
}): () => void {
  const h = hub();
  h.clients.set(input.id, input);
  void ensurePgListener();
  return () => {
    h.clients.delete(input.id);
  };
}

export function broadcastRealtime(ev: ZoreonEvent, exceptId?: string) {
  localBroadcast(ev, exceptId);
  if (dbSource === "neon") {
    void (async () => {
      try {
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const payload = JSON.stringify(ev).slice(0, 7900);
        await sql.query(`select pg_notify($1, $2)`, [CHANNEL, payload]);
      } catch {
        /* single-node ok */
      }
    })();
  }
}

export function realtimeClientCount() {
  return hub().clients.size;
}
