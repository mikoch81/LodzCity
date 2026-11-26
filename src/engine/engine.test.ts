import { describe, expect, it } from "vitest";
import { botMove } from "./ai";
import { CARDS } from "./data";
import { apply, def, GameError, newGame, povertyPenalty, type State } from "./engine";

const two = () => newGame([{ name: "A" }, { name: "B" }], 42);

// Put a fresh state into the action phase for player 0 with a chosen hand.
function setup(hand: string[], patch: (s: State) => void = () => {}): State {
  const s = two();
  s.current = 0;
  s.phase = "action";
  let uid = 1000;
  s.players[0].hand = hand.map((id) => {
    s.cards[++uid] = id;
    return uid;
  });
  patch(s);
  return s;
}

describe("talia", () => {
  it("ma 104 karty w podziale 28/44/32", () => {
    const count = (era: number) => CARDS.filter((c) => c.era === era).reduce((n, c) => n + c.copies, 0);
    expect([count(1), count(2), count(3)]).toEqual([28, 44, 32]);
  });

  it("rozdaje po 6 kart z Epoki I", () => {
    const s = two();
    for (const p of s.players) {
      expect(p.hand).toHaveLength(6);
      expect(p.hand.every((u) => def(s, u).era === 1)).toBe(true);
    }
    expect(s.deck.length).toBe(104 - 12);
  });
});

describe("inwestowanie", () => {
  it("wymaga odrzucenia karty tego samego koloru i płaci koszt", () => {
    const s = setup(["geyer", "warsztat"]);
    const [geyer, warsztat] = s.players[0].hand;
    const n = apply(s, { t: "invest", plays: [{ card: geyer, discard: warsztat }] });
    expect(n.players[0].empire).toHaveLength(1);
    expect(n.players[0].money).toBe(1);
    expect(n.market).toContain(warsztat);
  });

  it("odrzuca kartę innego koloru", () => {
    const s = setup(["geyer", "magistrat"]);
    const [geyer, mag] = s.players[0].hand;
    expect(() => apply(s, { t: "invest", plays: [{ card: geyer, discard: mag }] })).toThrow(GameError);
  });

  it("bierze weksel, gdy brakuje pieniędzy", () => {
    const s = setup(["scheibler", "warsztat"]);
    const [a, b] = s.players[0].hand;
    const n = apply(s, { t: "invest", plays: [{ card: a, discard: b }] });
    expect(n.players[0].loans).toBe(1);
    expect(n.players[0].money).toBe(8);
  });
});

describe("uruchamianie fabryk", () => {
  it("dolicza Nędzę: stosy + ręka − dzielnice", () => {
    const s = setup(["warsztat", "bezrobotni", "bezrobotni"], (s) => {
      s.players[0].empire = [{ cards: [s.players[0].hand.shift()!], flipped: false, placedTurn: 0 }];
      s.owner.stare_miasto = 0;
    });
    const pay = s.players[0].hand[0];
    const n = apply(s, { t: "run", acts: [{ stack: 0, pay: [pay] }] });
    // 1 stack + 1 card in hand − 1 district = +1
    expect(n.players[0].poverty).toBe(6);
    expect(n.players[0].money).toBe(8);
    expect(n.players[0].empire[0].flipped).toBe(true);
  });

  it("Strajk przy 12+ Nędzy blokuje Przemysł przy kolejnym uruchomieniu", () => {
    const s = setup(["geyer", "bezrobotni", "bezrobotni"], (s) => {
      s.players[0].empire = [{ cards: [s.players[0].hand.shift()!], flipped: false, placedTurn: 0 }];
      s.players[0].poverty = 11;
    });
    const n = apply(s, { t: "run", acts: [{ stack: 0, pay: [s.players[0].hand[0]] }] });
    expect(n.players[0].strike).toBe(true);
    const again = structuredClone(n);
    again.current = 0;
    again.phase = "action";
    expect(() => apply(again, { t: "run", acts: [{ stack: 0, pay: [again.players[0].hand[0]] }] })).toThrow(/Strajk/);
  });
});

describe("Strajk", () => {
  const struck = () => {
    const s = setup(["geyer", "bezrobotni", "bezrobotni"], (s) => {
      s.players[0].empire = [{ cards: [s.players[0].hand.shift()!], flipped: false, placedTurn: 0 }];
      s.players[0].poverty = 11;
    });
    return apply(s, { t: "run", acts: [{ stack: 0, pay: [s.players[0].hand[0]] }] });
  };

  it("wygasa po kolejnej turze gracza", () => {
    let s = struck();
    expect(s.players[0].strike).toBe(true);
    s = apply(s, { t: "draw", from: "deck" }); // player 1
    s = apply(s, { t: "take3", from: ["deck"] });
    s = apply(s, { t: "draw", from: "deck" }); // player 0, still striking this turn
    expect(s.players[0].strike).toBe(true);
    s = apply(s, { t: "take3", from: ["deck"] });
    expect(s.players[0].strike).toBe(false);
  });

  it("nie wraca, dopóki Nędza nie spadnie poniżej progu", () => {
    const s = struck();
    s.players[0].strike = false;
    s.current = 0;
    s.phase = "action";
    s.players[0].empire[0].flipped = false;
    const n = apply(s, { t: "run", acts: [{ stack: 0, pay: [s.players[0].hand[0]] }] });
    expect(n.players[0].strike).toBe(false);
  });

  it("karty zmniejszające Nędzę pracują mimo strajku", () => {
    const s = setup(["kolonia"], (s) => {
      s.players[0].empire = [{ cards: [s.players[0].hand.shift()!], flipped: false, placedTurn: 0 }];
      Object.assign(s.players[0], { strike: true, struckOn: s.turnNo, poverty: 14 });
    });
    const n = apply(s, { t: "run", acts: [{ stack: 0 }] });
    expect(n.players[0].poverty).toBe(14 - 2 + 1);
  });
});

describe("grunty i tory", () => {
  it("pierwszy zakup tylko w dzielnicy startowej", () => {
    const s = setup([]);
    expect(() => apply(s, { t: "buy", district: "srodmiescie" })).toThrow(GameError);
    const n = apply(s, { t: "buy", district: "nowe_miasto" });
    expect(n.owner.nowe_miasto).toBe(0);
    expect(n.players[0].hand).toHaveLength(1);
  });

  it("pierwszy grunt gracza musi być startowy, nawet obok cudzej dzielnicy", () => {
    const s = setup([], (s) => {
      s.owner.stare_miasto = 1;
    });
    expect(() => apply(s, { t: "buy", district: "ogrodowa" })).toThrow(/Pierwszy grunt/);
    expect(apply(s, { t: "buy", district: "lodka" }).owner.lodka).toBe(0);
  });

  it("gdy dzielnice startowe są zajęte, pierwszy grunt może sąsiadować z zajętą", () => {
    const s = setup([], (s) => {
      Object.assign(s.owner, { stare_miasto: 1, nowe_miasto: 1, lodka: 1 });
    });
    expect(apply(s, { t: "buy", district: "baluty" }).owner.baluty).toBe(0);
  });

  it("miasteczko wymaga toru w sąsiedniej dzielnicy", () => {
    const s = setup([], (s) => {
      s.owner.rokicie = 1;
      s.owner.stare_miasto = 0;
    });
    expect(() => apply(s, { t: "buy", district: "pabianice" })).toThrow(/tor/);
    s.tracks = ["rokicie"];
    expect(apply(s, { t: "buy", district: "pabianice" }).owner.pabianice).toBe(0);
  });
});

describe("punktacja", () => {
  it("tabela kar za Nędzę", () => {
    expect([0, 1, 2, 3, 4, 6].map(povertyPenalty)).toEqual([0, 1, 1, 2, 4, 8]);
  });
});

describe("boty", () => {
  it.each([1, 2, 3, 4, 5])("rozgrywają pełną grę bez błędów (ziarno %i)", (seed) => {
    let s = newGame(
      [{ name: "A", bot: "easy" }, { name: "B", bot: "medium" }, { name: "C", bot: "hard" }],
      seed,
    );
    let rngState = seed;
    const rnd = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647);
    let moves = 0;
    while (s.phase !== "over") {
      s = apply(s, botMove(s, rnd));
      if (++moves > 5000) throw new Error("gra się nie kończy");
    }
    expect(s.scores).toHaveLength(3);
    expect(s.deck).toHaveLength(0);
  });
});
