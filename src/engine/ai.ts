// Heuristic bot: builds a few candidate actions, simulates each with the real engine, keeps the best.
// shortcut: one-ply greedy search with level-based noise, upgrade to Monte Carlo rollouts if bots feel weak in playtests.
import { DISTRICTS, type CardDef } from "./data";
import {
  apply, canBuy, canTrack, def, GameError, hasPerm, strikeBlocks, HAND_LIMIT, landPrice, povertyPenalty, repayCost,
  type Action, type Player, type State,
} from "./engine";

export function cardValue(d: CardDef): number {
  if (d.color === "nedza") return d.event ? 1 : -3;
  const e = d.run?.effect;
  const run = e ? (e.money ?? 0) / 2 + (e.pp ?? 0) - (e.poverty ?? 0) + (e.tracks ?? 0) * 1.5 : 0;
  return d.pp + run * (d.run?.flips ? 1 : 2.5) + (d.permanent ? 4 : 0) - d.cost * 0.25;
}

function evaluate(s: State, pi: number): number {
  const p = s.players[pi];
  const left = s.deck.length / 104; // 1 at start, 0 at the end
  const all = p.empire.flatMap((st) => st.cards);
  let v = all.reduce((n, u) => n + def(s, u).pp, 0) + p.pp + p.money / 5 - p.loans * 8;
  for (const d of DISTRICTS) if (s.owner[d.id] === pi) v += d.pp + (s.tracks.includes(d.id) ? 2 : 0) + 1.5 * left * 4;
  for (const st of p.empire) {
    const d = def(s, st.cards[st.cards.length - 1]);
    if (d.run && !st.flipped) v += (cardValue(d) - d.pp) * (0.4 + left);
  }
  v += p.hand.reduce((n, u) => n + Math.max(0, cardValue(def(s, u))) * 0.25 * left, 0);
  v -= povertyPenalty(p.poverty + p.hand.length * (1 - left));
  if (p.strike) v -= 3;
  return v;
}

export const cheapest = (s: State, cards: number[], n: number, filter: (u: number) => boolean = () => true) =>
  [...cards].filter(filter).sort((a, b) => cardValue(def(s, a)) - cardValue(def(s, b))).slice(0, n);

function runAction(s: State, p: Player): Action | null {
  const hand = [...p.hand];
  const acts: { stack: number; pay?: number[]; tracks?: string[] }[] = [];
  const order = p.empire.map((st, i) => ({ st, i, d: def(s, st.cards[st.cards.length - 1]) }))
    .filter((x) => x.d.run && !x.st.flipped && !strikeBlocks(p, x.d, hasPerm(s, p, "noStrike")))
    .sort((a, b) => cardValue(b.d) - cardValue(a.d));
  let money = p.money;
  const placed: string[] = [];
  for (const { i, d } of order) {
    const cost = d.run!.pay;
    const act: (typeof acts)[number] = { stack: i };
    if (cost.kind === "money") {
      if (money < cost.n) continue;
      money -= cost.n;
    } else if (cost.kind === "card" || cost.kind === "culture") {
      const paid = cheapest(s, hand, cost.n, (u) => cost.kind === "card" || def(s, u).color === "kultura");
      if (paid.length < cost.n) continue;
      for (const u of paid) hand.splice(hand.indexOf(u), 1);
      act.pay = paid;
    }
    if (d.run!.effect.tracks) {
      act.tracks = [];
      for (let k = 0; k < d.run!.effect.tracks; k++) {
        const opts = DISTRICTS.filter((x) => canTrack(s, x.id, [...placed, ...act.tracks!]));
        const pick = opts.find((x) => s.owner[x.id] === s.current) ?? opts[0];
        if (pick) act.tracks.push(pick.id);
      }
      placed.push(...act.tracks);
    }
    acts.push(act);
  }
  return acts.length ? { t: "run", acts } : null;
}

function investActions(s: State, p: Player): Action[] {
  const out: Action[] = [];
  const playable = p.hand.filter((u) => def(s, u).color !== "nedza" || def(s, u).event)
    .sort((a, b) => cardValue(def(s, b)) - cardValue(def(s, a)));
  const flippedStacks = p.empire.map((st, i) => ({ st, i })).filter((x) => x.st.flipped && x.st.placedTurn !== s.turnNo);
  const plays: { card: number; discard?: number; onto?: number }[] = [];
  const used = new Set<number>();
  let money = p.money;
  for (const u of playable) {
    if (used.has(u)) continue;
    const d = def(s, u);
    if (d.event) {
      out.push({ t: "invest", plays: [{ card: u }] });
      continue;
    }
    const discard = cheapest(s, p.hand, 1, (x) => x !== u && !used.has(x) && def(s, x).color === d.color)[0];
    if (discard == null || d.cost > money + 5) continue;
    used.add(u).add(discard);
    money -= d.cost;
    const onto = flippedStacks.shift()?.i;
    plays.push({ card: u, discard, onto });
    out.push({ t: "invest", plays: [...plays] });
  }
  return out;
}

export function candidates(s: State): Action[] {
  const p = s.players[s.current];
  if (s.phase === "draw") {
    if (p.loans && p.money >= repayCost(s, p) + 3) return [{ t: "repay" }];
    // always the deck while it lasts: drawing from the Giełda lets a bot loop run→redraw forever
    if (s.deck.length) return [{ t: "draw", from: "deck" }];
    const i = s.market.findIndex((m) => m != null);
    return i >= 0 ? [{ t: "draw", from: i }] : [];
  }
  if (s.phase === "discard") {
    return [{ t: "discard", cards: cheapest(s, p.hand, p.hand.length - HAND_LIMIT) }];
  }
  const out: Action[] = [];
  const run = runAction(s, p);
  if (run) out.push(run);
  out.push(...investActions(s, p));
  for (const d of DISTRICTS) {
    if (!canBuy(s, s.current, d.id) && landPrice(s, p, d.id) <= p.money + 4) out.push({ t: "buy", district: d.id });
  }
  const market = s.market.map((m, i) => ({ m, i })).filter((x) => x.m != null)
    .sort((a, b) => cardValue(def(s, b.m!)) - cardValue(def(s, a.m!)));
  const from = market.slice(0, 3).map((x) => x.i as number | "deck");
  while (from.length < 3 && s.deck.length > from.filter((f) => f === "deck").length) from.push("deck");
  out.push({ t: "take3", from });
  return out;
}

const NOISE = { easy: 6, medium: 1.5, hard: 0 } as const;

export function botMove(s: State, rnd: () => number = Math.random): Action {
  const pi = s.current;
  const level = s.players[pi].bot ?? "medium";
  let best: Action | null = null;
  let bestV = -Infinity;
  for (const a of candidates(s)) {
    let next: State;
    try {
      next = apply(s, a);
    } catch (e) {
      if (e instanceof GameError) continue;
      throw e;
    }
    const v = evaluate(next, pi) + rnd() * NOISE[level];
    if (v > bestV) [best, bestV] = [a, v];
  }
  if (!best) throw new Error("Bot nie znalazł ruchu.");
  return best;
}
