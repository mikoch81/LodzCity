// Heuristic bot: builds a few candidate actions, simulates each with the real engine, keeps the best.
// Hard also plays one round ahead (rivals + its own next turn) before judging a move; more rollouts did not help in sims.
// Weights were tuned with src/engine/sim.test.ts; re-run it after changing cards or scoring.
import { DECK_SIZE, DISTRICTS, type CardDef } from "./data";
import {
  apply, canBuy, canTrack, def, GameError, hasPerm, strikeBlocks, HAND_LIMIT, landPrice, MONEY_PER_PP, povertyPenalty, repayCost,
  type Action, type BotLevel, type Player, type State,
} from "./engine";

export function cardValue(d: CardDef): number {
  if (d.color === "nedza") return d.event ? 1 : -3;
  const e = d.run?.effect;
  const run = e ? (e.money ?? 0) / 2 + (e.pp ?? 0) - (e.poverty ?? 0) + (e.tracks ?? 0) * 1.5 : 0;
  return d.pp + run * (d.run?.flips ? 1 : 2.5) + (d.permanent ? 4 : 0) - d.cost * 0.25;
}

export type Weights = {
  moneyEarly: number; // value of 1 rb at the start (it buys cards and land); falls to 1/MONEY_PER_PP at the end
  loan: number;
  hand: number;
  relative: boolean; // Nędza penalty against the poorest rival instead of absolute
  landLeft: number;
  strike: number;
  potential: number; // value of unused factories still able to run
};

const TUNED: Weights = {
  moneyEarly: 0.5, loan: 8, hand: 0.4, relative: true, landLeft: 12, strike: 3, potential: 1,
};

export const WEIGHTS: Record<BotLevel, Weights> = {
  // the first, untuned evaluation: it overvalues running factories and undervalues land, a fair beginner
  easy: { moneyEarly: 0.2, loan: 8, hand: 0.25, relative: false, landLeft: 6, strike: 3, potential: 1 },
  medium: { ...TUNED },
  hard: { ...TUNED },
};

// Nędza counted at the end: tokens plus cards left in hand
const endPoverty = (p: Player) => p.poverty + p.hand.length;

function evaluate(s: State, pi: number, w: Weights): number {
  const p = s.players[pi];
  const left = s.deck.length / DECK_SIZE; // 1 at start, 0 at the end
  const all = p.empire.flatMap((st) => st.cards);
  const moneyW = 1 / MONEY_PER_PP + (w.moneyEarly - 1 / MONEY_PER_PP) * left;
  let v = all.reduce((n, u) => n + def(s, u).pp, 0) + p.pp + p.money * moneyW - p.loans * w.loan;
  for (const d of DISTRICTS) if (s.owner[d.id] === pi) v += d.pp + (s.tracks.includes(d.id) ? 2 : 0) + left * w.landLeft;
  for (const st of p.empire) {
    const d = def(s, st.cards[st.cards.length - 1]);
    if (d.run && !st.flipped) v += (cardValue(d) - d.pp) * (0.4 + left) * w.potential;
  }
  v += p.hand.reduce((n, u) => n + Math.max(0, cardValue(def(s, u))) * w.hand * left, 0);
  if (w.relative) {
    const mine = endPoverty(p);
    const least = Math.min(mine, ...s.players.filter((q) => q !== p).map((q) => endPoverty(q)));
    v -= povertyPenalty(mine - least);
  } else v -= povertyPenalty(p.poverty + p.hand.length * (1 - left));
  if (p.strike) v -= w.strike;
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
export const LOOKAHEAD: Record<BotLevel, boolean> = { easy: false, medium: false, hard: true };

function greedy(s: State, pi: number, w: Weights, noise: number, rnd: () => number, ahead: boolean): Action {
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
    let v = rnd() * noise;
    if (!ahead) v += evaluate(next, pi, w);
    else v += evaluate(playOn(next, pi, rnd), pi, w);
    if (v > bestV) [best, bestV] = [a, v];
  }
  if (!best) throw new Error("Bot nie znalazł ruchu.");
  return best;
}

// Plays the rivals' turns and the bot's own next turn with the plain greedy policy, so a move is judged by
// what it leads to a round later. The deck is shuffled first: the bot must not see the real order of cards.
function playOn(s: State, pi: number, rnd: () => number): State {
  s = { ...s, deck: [...s.deck].sort(() => rnd() - 0.5), log: [] };
  const step = () => (s = apply(s, greedy(s, s.current, WEIGHTS[s.players[s.current].bot ?? "medium"], 0, rnd, false)));
  while (s.phase !== "over" && s.current === pi) step(); // finish this turn (discard)
  while (s.phase !== "over" && s.current !== pi) step(); // rivals
  while (s.phase !== "over" && s.current === pi) step(); // own next turn
  return s;
}

export function botMove(s: State, rnd: () => number = Math.random): Action {
  const level = s.players[s.current].bot ?? "medium";
  const ahead = LOOKAHEAD[level] && s.phase === "action";
  return greedy(s, s.current, WEIGHTS[level], NOISE[level], rnd, ahead);
}
