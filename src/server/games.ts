// Online games: lobby, seats and server-validated moves. Storage is behind `Store` so tests run in memory.
import { randomUUID } from "node:crypto";
import { botMove } from "../engine/ai";
import { apply, GameError, newGame, type Action, type BotLevel, type State } from "../engine/engine";

export type Seat = { name: string; token: string };
export type Lobby = { players: Seat[]; bots: number; level: BotLevel };
export type GameRow = { id: string; lobby: Lobby; state: State | null; version: number };

export interface Store {
  create(lobby: Lobby): Promise<string>;
  get(id: string): Promise<GameRow | null>;
  /** Saves only if the stored version still equals row.version - 1 (optimistic lock). */
  save(row: GameRow): Promise<boolean>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const BOT_NAMES = ["Ród Scheiblerów", "Ród Poznańskich", "Ród Geyerów"];
const MAX_PLAYERS = 4;

function cleanName(name: unknown): string {
  const n = typeof name === "string" ? name.trim().slice(0, 24) : "";
  if (!n) throw new HttpError(400, "Podaj imię.");
  return n;
}

async function load(store: Store, id: string): Promise<GameRow> {
  const row = await store.get(id);
  if (!row) throw new HttpError(404, "Nie ma takiej gry.");
  return row;
}

const seatOf = (row: GameRow, token: unknown) => row.lobby.players.findIndex((p) => p.token === token);

async function commit(store: Store, row: GameRow) {
  if (!(await store.save({ ...row, version: row.version + 1 }))) {
    throw new HttpError(409, "Ktoś zrobił ruch w tym samym momencie. Spróbuj jeszcze raz.");
  }
}

export async function createGame(store: Store, name: unknown) {
  const token = randomUUID();
  const id = await store.create({ players: [{ name: cleanName(name), token }], bots: 0, level: "medium" });
  return { id, token };
}

export async function joinGame(store: Store, id: string, name: unknown) {
  const row = await load(store, id);
  if (row.state) throw new HttpError(409, "Gra już się zaczęła.");
  if (row.lobby.players.length >= MAX_PLAYERS) throw new HttpError(409, "Pokój jest pełny.");
  const token = randomUUID();
  row.lobby.players.push({ name: cleanName(name), token });
  await commit(store, row);
  return { token };
}

export async function startGame(store: Store, id: string, token: unknown, bots: unknown, level: unknown) {
  const row = await load(store, id);
  if (seatOf(row, token) !== 0) throw new HttpError(403, "Grę zaczyna tylko gospodarz.");
  if (row.state) throw new HttpError(409, "Gra już się zaczęła.");
  const humans = row.lobby.players.length;
  const nBots = Math.max(0, Math.min(MAX_PLAYERS - humans, Number(bots) || 0));
  if (humans + nBots < 2) throw new HttpError(400, "Potrzeba co najmniej 2 graczy (dodaj bota albo zaproś kogoś).");
  const lvl: BotLevel = level === "easy" || level === "hard" ? level : "medium";
  row.lobby.bots = nBots;
  row.lobby.level = lvl;
  // seats keep lobby order: humans first, then bots
  row.state = runBots(newGame([
    ...row.lobby.players.map((p) => ({ name: p.name })),
    ...BOT_NAMES.slice(0, nBots).map((n) => ({ name: n, bot: lvl })),
  ]));
  await commit(store, row);
}

function runBots(s: State): State {
  while (s.phase !== "over" && s.players[s.current].bot) s = apply(s, botMove(s));
  return s;
}

export async function move(store: Store, id: string, token: unknown, action: unknown) {
  const row = await load(store, id);
  const seat = seatOf(row, token);
  if (seat < 0) throw new HttpError(403, "Nie grasz w tej grze.");
  if (!row.state) throw new HttpError(409, "Gra jeszcze się nie zaczęła.");
  if (row.state.current !== seat) throw new HttpError(409, "To nie Twoja tura.");
  if (!action || typeof action !== "object" || typeof (action as Action).t !== "string") {
    throw new HttpError(400, "Nieprawidłowy ruch.");
  }
  try {
    row.state = runBots(apply(row.state, action as Action));
  } catch (e) {
    if (e instanceof GameError) throw new HttpError(400, e.message);
    throw new HttpError(400, "Nieprawidłowy ruch."); // malformed input from the client
  }
  await commit(store, row);
}

/** What one player may see: no tokens, no other hands, no deck order, no RNG seed. */
export function view(row: GameRow, token: unknown) {
  const seat = seatOf(row, token);
  const players = row.lobby.players.map((p) => p.name);
  let state: State | null = null;
  if (row.state) {
    state = structuredClone(row.state);
    state.players.forEach((p, i) => {
      if (i !== seat) p.hand = p.hand.map(() => 0);
    });
    state.deck = state.deck.map(() => 0);
    state.rng = 0;
  }
  return { id: row.id, version: row.version, players, bots: row.lobby.bots, seat, state };
}

export type GameView = ReturnType<typeof view>;
