"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Action, BotLevel } from "@/engine/engine";
import type { GameView } from "@/server/games";
import { Board } from "../../Game";
import css from "../../Game.module.css";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function Online({ id }: { id: string }) {
  const key = `fabrykant:${id}`;
  const [token, setToken] = useState<string | null>(null);
  const [v, setV] = useState<GameView | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => setToken(localStorage.getItem(key)), [key]);

  const call = useCallback(async (body?: object) => {
    const r = await fetch(`/api/games/${id}`, {
      method: body ? "POST" : "GET",
      headers: { "x-token": localStorage.getItem(key) ?? "" },
      body: body && JSON.stringify(body),
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok) return j.error as string;
    if (j.token) {
      localStorage.setItem(key, j.token);
      setToken(j.token);
    } else setV((old) => (old && old.version > j.version ? old : j));
    return null;
  }, [id, key]);

  // refresh on every change: realtime ping from Supabase when configured, plus a slow poll as a safety net
  useEffect(() => {
    let alive = true;
    const refresh = () => alive && call().then((e) => e && setErr(e));
    refresh();
    const t = setInterval(refresh, URL && ANON ? 15000 : 2000);
    let stop = () => {};
    if (URL && ANON) {
      const sb = createClient(URL, ANON);
      const ch = sb.channel(`game-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "game_versions", filter: `game_id=eq.${id}` }, refresh)
        .subscribe();
      stop = () => void sb.removeChannel(ch);
    }
    return () => {
      alive = false;
      clearInterval(t);
      stop();
    };
  }, [id, call, token]);

  if (!v) return <main className={css.menu}><div className={css.menuCol}><div className={`${css.plaque} ${css.setup}`}><p>{err || "Ładowanie…"}</p></div></div></main>;

  if (v.seat < 0) return <Join started={!!v.state} full={v.players.length >= 4} onJoin={(name) => call({ op: "join", name })} />;

  if (!v.state) return <Lobby v={v} onStart={(bots, level) => call({ op: "start", bots, level })} />;

  return (
    <Board
      s={v.state} seat={v.seat}
      onAction={(action: Action) => call({ op: "move", action })}
      onExit={() => (location.href = "/")}
    />
  );
}

function Join({ started, full, onJoin }: { started: boolean; full: boolean; onJoin: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  if (started || full) {
    return <main className={css.menu}><div className={css.menuCol}><div className={`${css.plaque} ${css.setup}`}><h1>Fabrykant</h1><p>{started ? "Ta gra już trwa." : "Pokój jest pełny."}</p><Link href="/">Nowa gra</Link></div></div></main>;
  }
  return (
    <main className={css.menu}><div className={css.menuCol}><div className={`${css.plaque} ${css.setup}`}>
      <h1>Fabrykant</h1>
      <p>Zaproszono Cię do gry online.</p>
      <label>Twoje imię <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} /></label>
      <button type="button" onClick={async () => setErr((await onJoin(name)) ?? "")}>Dołącz</button>
      {err && <p className={css.error} role="alert">{err}</p>}
    </div></div></main>
  );
}

function Lobby({ v, onStart }: { v: GameView; onStart: (bots: number, level: BotLevel) => Promise<string | null> }) {
  const free = 4 - v.players.length;
  const [bots, setBots] = useState(v.players.length === 1 ? 1 : 0);
  const [level, setLevel] = useState<BotLevel>("medium");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : window.location.href;
  return (
    <main className={css.menu}><div className={css.menuCol}><div className={`${css.plaque} ${css.setup}`}>
      <h1>Pokój gry</h1>
      <p>Wyślij ten link znajomym:</p>
      <button type="button" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
        {copied ? "Skopiowano!" : "Kopiuj link do pokoju"}
      </button>
      <h2>Gracze ({v.players.length}/4)</h2>
      <ol className={css.pending}>{v.players.map((p, i) => <li key={i}>{p}{i === 0 ? " (gospodarz)" : ""}{i === v.seat ? " · Ty" : ""}</li>)}</ol>
      {v.seat === 0 ? (
        <>
          <label>
            Dodaj boty
            <select value={bots} onChange={(e) => setBots(Number(e.target.value))}>
              {Array.from({ length: free + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {bots > 0 && (
            <label>
              Poziom botów
              <select value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
                <option value="easy">Łatwy</option>
                <option value="medium">Średni</option>
                <option value="hard">Trudny</option>
              </select>
            </label>
          )}
          <button type="button" onClick={async () => setErr((await onStart(bots, level)) ?? "")}>Zacznij grę</button>
        </>
      ) : (
        <p className={css.muted}>Czekamy, aż gospodarz zacznie grę.</p>
      )}
      {err && <p className={css.error} role="alert">{err}</p>}
    </div></div></main>
  );
}
