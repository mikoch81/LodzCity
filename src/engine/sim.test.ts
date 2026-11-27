// Balance simulator: SIM=200 npx vitest run src/engine/sim.test.ts  (skipped in the normal test run)
import { describe, it } from "vitest";
import { botMove } from "./ai";
import { apply, newGame, ranking, type BotLevel, type State } from "./engine";

const N = Number(process.env.SIM ?? 0);
const LEVELS = (process.env.LEVELS ?? "hard,medium,easy").split(",") as BotLevel[];

describe.skipIf(!N)("symulacja balansu", () => {
  it(`${N} partii: ${LEVELS.join(" vs ")}`, () => {
    const wins: Record<string, number> = {};
    const sum: Record<string, number> = {};
    const add = (k: string, v: number) => (sum[k] = (sum[k] ?? 0) + v);
    let players = 0;
    for (let g = 1; g <= N; g++) {
      // rotate seats so no level always sits first
      const lv = LEVELS.map((_, i) => LEVELS[(i + g) % LEVELS.length]);
      let s: State = newGame(lv.map((b, i) => ({ name: `${b}${i}`, bot: b })), g * 7919);
      let r = g;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const struck = new Set<number>();
      const acts: Record<string, number> = {};
      let moves = 0;
      while (s.phase !== "over") {
        const a = botMove(s, rnd);
        acts[a.t] = (acts[a.t] ?? 0) + 1;
        add(`${s.players[s.current].bot} akcja ${a.t}`, 1);
        if (a.t === "invest") add("invested cards", a.plays.length);
        s = apply(s, a);
        s.players.forEach((p, i) => p.strike && struck.add(i));
        if (++moves > 5000) throw new Error("gra się nie kończy");
      }
      const best = ranking(s, s.scores!)[0];
      wins[s.players[best.player].bot!] = (wins[s.players[best.player].bot!] ?? 0) + 1;
      for (const [k, v] of Object.entries(acts)) add(`akcja ${k}`, v);
      add("tory na planszy", s.tracks.length);
      add("zajęte dzielnice", Object.values(s.owner).filter((o) => o != null).length);
      for (const sc of s.scores!) {
        players++;
        const p = s.players[sc.player];
        for (const k of ["total", "cards", "districts", "tracks", "tokens", "money", "loans", "povertyPenalty"] as const)
        {
          add(`gracz ${k}`, sc[k]);
          add(`${p.bot} ${k}`, sc[k]);
        }
        add("gracz ruble na koniec", p.money);
        add("gracz karty w imperium", p.empire.reduce((n, st) => n + st.cards.length, 0));
        add("gracz weksle", p.loans);
        add("gracz strajkował", struck.has(sc.player) ? 1 : 0);
      }
      add("wynik zwycięzcy", best.total);
    }
    const out = [`Wygrane (${N} partii): ${LEVELS.map((l) => `${l} ${(((wins[l] ?? 0) / N) * 100).toFixed(0)}%`).join(", ")}`];
    for (const [k, v] of Object.entries(sum)) out.push(`${k}: ${(v / (k.startsWith("gracz") ? players : LEVELS.some((l) => k.startsWith(l + " ")) ? (players / LEVELS.length) : N)).toFixed(2)}`);
    console.log(out.join("\n"));
  }, 600_000);
});
