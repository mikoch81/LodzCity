// Pure rules engine: apply(state, action) -> new state. Same code runs in the browser (solo) and on the server (multiplayer).
import { ADJ, CARD_BY_ID, CARDS, DISTRICT_BY_ID, DISTRICTS, TRACK_START, type CardDef, type Permanent } from "./data";

export type BotLevel = "easy" | "medium" | "hard";

export type Stack = { cards: number[]; flipped: boolean; placedTurn: number };

export type Player = {
  name: string;
  bot?: BotLevel;
  money: number;
  poverty: number;
  hand: number[];
  empire: Stack[];
  loans: number;
  pp: number;
  strike: boolean;
};

export type Score = {
  player: number;
  cards: number;
  districts: number;
  tracks: number;
  tokens: number;
  money: number;
  loans: number;
  poverty: number; // remaining poverty after the "least poverty" reduction
  povertyPenalty: number;
  total: number;
};

export type State = {
  cards: Record<number, string>; // card uid -> card def id
  players: Player[];
  current: number;
  phase: "draw" | "action" | "discard" | "over";
  deck: number[]; // top = last
  market: (number | null)[]; // 2 rows of `slots`
  slots: number;
  owner: Record<string, number | null>;
  tracks: string[];
  turnNo: number;
  finalTurns: number | null;
  rng: number;
  log: string[];
  scores?: Score[];
};

export type Source = "deck" | number; // number = market index

export type Action =
  | { t: "repay" }
  | { t: "draw"; from: Source }
  | { t: "invest"; plays: { card: number; discard?: number; onto?: number }[] }
  | { t: "buy"; district: string }
  | { t: "take3"; from: Source[] }
  | { t: "run"; acts: { stack: number; pay?: number[]; tracks?: string[] }[] }
  | { t: "discard"; cards: number[] };

export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg);
};

export const HAND_LIMIT = 9;
export const STRIKE_AT = 12;
export const LOAN = 10;

export const def = (s: State, uid: number): CardDef => CARD_BY_ID[s.cards[uid]];

// mulberry32, state kept in s.rng so games replay deterministically
function rand(s: State): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(s: State, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(players: { name: string; bot?: BotLevel }[], seed = Date.now()): State {
  if (players.length < 2 || players.length > 4) fail("Gra jest dla 2–4 graczy.");
  const s: State = {
    cards: {},
    players: players.map((p) => ({ ...p, money: 5, poverty: 5, hand: [], empire: [], loans: 0, pp: 0, strike: false })),
    current: 0,
    phase: "draw",
    deck: [],
    market: [],
    slots: players.length + 1,
    owner: Object.fromEntries(DISTRICTS.map((d) => [d.id, null])),
    tracks: [],
    turnNo: 1,
    finalTurns: null,
    rng: seed | 0,
    log: [],
  };
  s.market = Array(s.slots * 2).fill(null);
  let uid = 0;
  const eras: number[][] = [[], [], []];
  for (const d of CARDS) for (let i = 0; i < d.copies; i++) {
    s.cards[++uid] = d.id;
    eras[d.era - 1].push(uid);
  }
  s.deck = [...shuffle(s, eras[2]), ...shuffle(s, eras[1]), ...shuffle(s, eras[0])];
  for (const p of s.players) for (let i = 0; i < 6; i++) p.hand.push(s.deck.pop()!);
  s.current = Math.floor(rand(s) * players.length);
  s.log.push(`Zaczyna ${s.players[s.current].name}.`);
  skipEmptyDraw(s);
  return s;
}

export const hasPerm = (s: State, p: Player, perm: Permanent) =>
  p.empire.some((st) => def(s, st.cards[st.cards.length - 1]).permanent === perm);

export const ownedCount = (s: State, pi: number) => Object.values(s.owner).filter((o) => o === pi).length;

export const repayCost = (s: State, p: Player) => (hasPerm(s, p, "loanRepay12") ? 12 : 15);

export const landPrice = (s: State, p: Player, district: string) =>
  Math.max(0, DISTRICT_BY_ID[district].price - (hasPerm(s, p, "landDiscount") ? 1 : 0));

function pay(s: State, p: Player, amount: number) {
  if (p.money < amount) {
    const n = Math.ceil((amount - p.money) / LOAN);
    p.loans += n;
    p.money += n * LOAN;
    s.log.push(`${p.name} bierze weksel (${n}× ${LOAN} rb).`);
  }
  p.money -= amount;
}

function toMarket(s: State, uid: number) {
  let i = s.market.indexOf(null);
  if (i < 0) {
    // both rows full: top row leaves the game, bottom row slides up
    s.market = [...s.market.slice(s.slots), ...Array(s.slots).fill(null)];
    i = s.slots;
  }
  s.market[i] = uid;
}

function takeFrom(s: State, p: Player, from: Source): void {
  if (from === "deck") {
    if (!s.deck.length) fail("Talia jest pusta.");
    p.hand.push(s.deck.pop()!);
    if (!s.deck.length && s.finalTurns === null) {
      s.finalTurns = s.players.length - 1;
      s.log.push("Talia się skończyła: każdy pozostały gracz ma jeszcze jedną turę.");
    }
  } else {
    const uid = s.market[from];
    if (uid == null) fail("To miejsce Giełdy jest puste.");
    p.hand.push(uid!);
    s.market[from] = null;
  }
}

function removeFromHand(p: Player, uid: number) {
  const i = p.hand.indexOf(uid);
  if (i < 0) fail("Tej karty nie masz w ręce.");
  p.hand.splice(i, 1);
}

const canDraw = (s: State) => s.deck.length > 0 || s.market.some((m) => m != null);

function skipEmptyDraw(s: State) {
  if (s.phase === "draw" && !canDraw(s)) s.phase = "action";
}

export function isOccupiedAnywhere(s: State) {
  return Object.values(s.owner).some((o) => o != null);
}

export function canBuy(s: State, pi: number, district: string): string | null {
  const d = DISTRICT_BY_ID[district];
  if (!d) return "Nie ma takiej dzielnicy.";
  if (s.owner[district] != null) return "Ta dzielnica jest już zajęta.";
  const nearOccupied = ADJ[district].some((n) => s.owner[n] != null);
  if (!d.start && !nearOccupied) return "Dzielnica musi sąsiadować z zajętą albo być dzielnicą startową.";
  if (d.town && !ADJ[district].some((n) => s.tracks.includes(n)))
    return "Do miasteczka musi najpierw dojść tor z sąsiedniej dzielnicy.";
  void pi;
  return null;
}

export function canTrack(s: State, district: string, placed: string[]): boolean {
  if (!DISTRICT_BY_ID[district] || DISTRICT_BY_ID[district].town) return false;
  if (s.owner[district] == null) return false;
  const all = [...s.tracks, ...placed];
  if (all.includes(district)) return false;
  if (!all.length) return district === TRACK_START || ADJ[TRACK_START].includes(district);
  return ADJ[district].some((n) => all.includes(n));
}

export function apply(state: State, a: Action): State {
  if (state.phase === "over") fail("Gra jest zakończona.");
  const s: State = structuredClone(state);
  const pi = s.current;
  const p = s.players[pi];

  switch (a.t) {
    case "repay": {
      if (s.phase !== "draw") fail("Weksel spłacasz na początku tury.");
      if (!p.loans) fail("Nie masz weksli.");
      const cost = repayCost(s, p);
      if (p.money < cost) fail(`Spłata kosztuje ${cost} rb.`);
      p.money -= cost;
      p.loans--;
      s.log.push(`${p.name} spłaca weksel.`);
      return s;
    }
    case "draw": {
      if (s.phase !== "draw") fail("Kartę dobierasz na początku tury.");
      takeFrom(s, p, a.from);
      s.phase = "action";
      return s;
    }
    case "discard": {
      if (s.phase !== "discard") fail("Teraz nie odrzucasz kart.");
      if (p.hand.length - a.cards.length !== HAND_LIMIT) fail(`Odrzuć do ${HAND_LIMIT} kart.`);
      for (const uid of a.cards) {
        removeFromHand(p, uid);
        toMarket(s, uid);
      }
      return endTurn(s);
    }
  }

  if (s.phase !== "action") fail("Najpierw dobierz kartę.");

  switch (a.t) {
    case "invest": {
      if (!a.plays.length) fail("Zagraj co najmniej jedną kartę.");
      for (const play of a.plays) {
        const d = def(s, play.card);
        removeFromHand(p, play.card);
        if (d.event) {
          for (const q of s.players) if (q.poverty >= 8) q.strike = true;
          s.log.push(`${p.name} zagrywa „${d.name}”: strajkują rody z 8+ Nędzy.`);
          continue;
        }
        if (d.color === "nedza") fail("Karty Nędzy nie da się zainwestować.");
        if (play.discard == null) fail("Każda karta wymaga odrzucenia karty tego samego koloru.");
        if (def(s, play.discard!).color !== d.color) fail("Odrzucona karta musi mieć ten sam kolor.");
        removeFromHand(p, play.discard!);
        toMarket(s, play.discard!);
        pay(s, p, d.cost);
        if (play.onto != null) {
          const st = p.empire[play.onto];
          if (!st) fail("Nie ma takiego stosu.");
          if (st.placedTurn === s.turnNo) fail("Nie możesz przykryć karty zagranej w tej turze.");
          st.cards.push(play.card);
          st.flipped = false;
          st.placedTurn = s.turnNo;
        } else {
          p.empire.push({ cards: [play.card], flipped: false, placedTurn: s.turnNo });
        }
        s.log.push(`${p.name} inwestuje w „${d.name}”.`);
      }
      break;
    }
    case "buy": {
      const why = canBuy(s, pi, a.district);
      if (why) fail(why);
      const d = DISTRICT_BY_ID[a.district];
      pay(s, p, landPrice(s, p, a.district));
      s.owner[a.district] = pi;
      for (let i = 0; i < d.cards && s.deck.length; i++) takeFrom(s, p, "deck");
      s.log.push(`${p.name} kupuje grunt: ${d.name}.`);
      break;
    }
    case "take3": {
      // an empty take is allowed only when nothing is left to take, so a player is never stuck
      if (a.from.length > 3 || (!a.from.length && canDraw(s))) fail("Weź od 1 do 3 kart.");
      const used = a.from.filter((f) => f !== "deck");
      if (new Set(used).size !== used.length) fail("Każde miejsce Giełdy możesz wziąć raz.");
      for (const f of a.from) takeFrom(s, p, f);
      s.log.push(`${p.name} bierze karty z talii i Giełdy: ${a.from.length}.`);
      break;
    }
    case "run": {
      if (!a.acts.length) fail("Uruchom co najmniej jedną kartę.");
      const seen = new Set<number>();
      const noStrike = hasPerm(s, p, "noStrike");
      for (const act of a.acts) {
        const st = p.empire[act.stack];
        if (!st || seen.has(act.stack)) fail("Nieprawidłowy stos.");
        seen.add(act.stack);
        const d = def(s, st.cards[st.cards.length - 1]);
        if (!d.run) fail(`„${d.name}” nie ma uruchomienia.`);
        if (st.flipped) fail(`„${d.name}” jest już zużyta.`);
        if (p.strike && d.color === "przemysl" && !noStrike) fail(`Strajk: „${d.name}” nie pracuje w tej turze.`);
        const { pay: cost, effect, flips } = d.run!;
        if (cost.kind === "money") pay(s, p, cost.n);
        if (cost.kind === "card" || cost.kind === "culture") {
          const paid = act.pay ?? [];
          if (paid.length !== cost.n) fail(`„${d.name}” wymaga odrzucenia ${cost.n} kart.`);
          for (const uid of paid) {
            if (cost.kind === "culture" && def(s, uid).color !== "kultura") fail("Trzeba odrzucić kartę Kultury.");
            removeFromHand(p, uid);
            toMarket(s, uid);
          }
        }
        p.money += effect.money ?? 0;
        p.pp += effect.pp ?? 0;
        p.poverty = Math.max(0, p.poverty + (effect.poverty ?? 0));
        if (effect.tracks) {
          const placed: string[] = [];
          for (const t of act.tracks ?? []) {
            if (placed.length >= effect.tracks) fail("Za dużo torów.");
            if (!canTrack(s, t, placed)) fail(`Nie można położyć toru: ${DISTRICT_BY_ID[t]?.name ?? t}.`);
            placed.push(t);
          }
          s.tracks.push(...placed);
        }
        if (flips) st.flipped = true;
      }
      const gained = p.empire.length + p.hand.length - ownedCount(s, pi);
      p.poverty = Math.max(0, p.poverty + gained);
      s.log.push(`${p.name} uruchamia fabryki, Nędza ${gained >= 0 ? "+" : ""}${gained}.`);
      p.strike = false;
      if (p.poverty >= STRIKE_AT) {
        p.strike = true;
        s.log.push(`Strajk u ${p.name}: fabryki Przemysłu staną przy następnym uruchomieniu.`);
      }
      break;
    }
    default:
      fail("Nieznana akcja.");
  }

  if (p.hand.length > HAND_LIMIT) {
    s.phase = "discard";
    return s;
  }
  return endTurn(s);
}

function endTurn(s: State): State {
  if (s.finalTurns !== null) {
    if (s.finalTurns === 0) return finish(s);
    s.finalTurns--;
  }
  s.current = (s.current + 1) % s.players.length;
  s.turnNo++;
  s.phase = "draw";
  skipEmptyDraw(s);
  return s;
}

export function povertyPenalty(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return 2 + 2 * (n - 3);
}

export function score(s: State): Score[] {
  const pov = s.players.map((p) => p.poverty + p.hand.length);
  const least = Math.min(...pov);
  return s.players.map((p, pi) => {
    const all = p.empire.flatMap((st) => st.cards);
    const perIndustry = hasPerm(s, p, "ppPerIndustry") ? all.filter((u) => def(s, u).color === "przemysl").length : 0;
    const owned = DISTRICTS.filter((d) => s.owner[d.id] === pi);
    const r: Score = {
      player: pi,
      cards: all.reduce((n, u) => n + def(s, u).pp, 0) + perIndustry,
      districts: owned.reduce((n, d) => n + d.pp, 0),
      tracks: owned.filter((d) => s.tracks.includes(d.id)).length * 2,
      tokens: p.pp,
      money: Math.floor(p.money / 3),
      loans: -7 * p.loans,
      poverty: pov[pi] - least,
      povertyPenalty: -povertyPenalty(pov[pi] - least),
      total: 0,
    };
    r.total = r.cards + r.districts + r.tracks + r.tokens + r.money + r.loans + r.povertyPenalty;
    return r;
  });
}

// Winner order: total, then less poverty, then more districts.
export function ranking(s: State, scores: Score[]): Score[] {
  return [...scores].sort(
    (a, b) => b.total - a.total || a.poverty - b.poverty || ownedCount(s, b.player) - ownedCount(s, a.player),
  );
}

function finish(s: State): State {
  s.phase = "over";
  s.scores = score(s);
  const best = ranking(s, s.scores)[0];
  s.log.push(`Koniec gry. Wygrywa ${s.players[best.player].name} (${best.total} PP).`);
  return s;
}
