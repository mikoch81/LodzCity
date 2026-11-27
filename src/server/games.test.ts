import { describe, expect, it } from "vitest";
import { createGame, HttpError, joinGame, move, startGame, view } from "./games";
import { MemoryStore } from "./store";

async function room(bots = 0) {
  const store = new MemoryStore();
  const host = await createGame(store, "Michał");
  const guest = await joinGame(store, host.id, "Ania");
  await startGame(store, host.id, host.token, bots, "medium");
  return { store, id: host.id, host: host.token, guest: guest.token };
}

describe("gra online", () => {
  it("tylko gospodarz zaczyna grę", async () => {
    const store = new MemoryStore();
    const host = await createGame(store, "Michał");
    const guest = await joinGame(store, host.id, "Ania");
    await expect(startGame(store, host.id, guest.token, 0, "medium")).rejects.toThrow(HttpError);
  });

  it("widok ukrywa cudze karty, talię i tokeny", async () => {
    const { store, id, host } = await room();
    const v = view((await store.get(id))!, host);
    expect(v.seat).toBe(0);
    expect(v.state!.players[0].hand.some((u) => u > 0)).toBe(true);
    expect(v.state!.players[1].hand.every((u) => u === 0)).toBe(true);
    expect(v.state!.deck.every((u) => u === 0)).toBe(true);
    expect(JSON.stringify(v)).not.toContain(host);
  });

  it("ruch poza swoją turą jest odrzucany, w swojej przyjmowany", async () => {
    const { store, id, host, guest } = await room();
    const s = (await store.get(id))!.state!;
    const [mine, other] = s.current === 0 ? [host, guest] : [guest, host];
    await expect(move(store, id, other, { t: "draw", from: "deck" })).rejects.toThrow(/nie Twoja tura/);
    await move(store, id, mine, { t: "draw", from: "deck" });
    expect((await store.get(id))!.state!.phase).toBe("action");
  });

  it("śmieciowe dane ruchu dają 400, a nie błąd serwera", async () => {
    const { store, id, host, guest } = await room();
    const mine = (await store.get(id))!.state!.current === 0 ? host : guest;
    await expect(move(store, id, mine, { t: "invest", plays: "x" })).rejects.toMatchObject({ status: 400 });
    await expect(move(store, id, mine, null)).rejects.toMatchObject({ status: 400 });
  });

  it("boty grają same po ruchu człowieka", async () => {
    const store = new MemoryStore();
    const host = await createGame(store, "Michał");
    await startGame(store, host.id, host.token, 2, "easy");
    expect((await store.get(host.id))!.state!.current).toBe(0);
  });

  it("nie można dołączyć do trwającej gry", async () => {
    const { store, id } = await room();
    await expect(joinGame(store, id, "Spóźniony")).rejects.toThrow(/zaczęła/);
  });
});
