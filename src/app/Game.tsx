"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { botMove, cheapest } from "@/engine/ai";
import { ADJ, CARDS, DISTRICTS, DISTRICT_BY_ID, type CardDef, type Color, type Permanent } from "@/engine/data";
import {
  apply, canBuy, canTrack, def, GameError, HAND_LIMIT, hasPerm, landPrice, LOAN, MONEY_PER_PP, newGame, ownedCount, povertyPenalty, ranking, repayCost, score,
  STRIKE_AT, strikeBlocks, type Action, type BotLevel, type Score, type State,
} from "@/engine/engine";
import { ART } from "./art";
import { Count, useAnimPref, useFxPlayer, useSoundPref } from "./Fx";
import css from "./Game.module.css";
import fx from "./Fx.module.css";
import { Terrain } from "./Terrain";
import { BOARD, CELLS } from "./boardGeo";

const COLOR_NAME: Record<Color, string> = { przemysl: "Przemysł", wladza: "Władza", kultura: "Kultura", nedza: "Nędza" };
const PLAYER_COLORS = ["#d9a441", "#7fb2d9", "#c97a9a", "#8fc28a"];

// [full text on a big card / tooltip, short label on a small card]
const PERM: Record<Permanent, [string, string]> = {
  landDiscount: ["grunty tańsze o 1 rb", "grunt −1 rb"],
  loanRepay12: ["spłata weksla 12 rb", "weksel 12 rb"],
  ppPerIndustry: ["+1 PP za każdą kartę Przemysłu", "+1 PP / Przemysł"],
  noStrike: ["Twój Przemysł nie strajkuje", "bez strajku"],
};
const minus = (n: number) => `${n}`.replace("-", "−");

/** Plain words for the tooltip; the card face shows the same as icons (Effect). */
function runText(d: CardDef): string {
  if (d.event) return "Zdarzenie: strajkują rody z 8+ Nędzy";
  const perm = d.permanent ? `Stale: ${PERM[d.permanent][0]}` : "";
  if (!d.run) return perm || (d.color === "nedza" ? "Martwa karta: nic nie daje, a w ręce dokłada Nędzy" : "");
  const { pay, effect, flips } = d.run;
  const kart = (n: number) => `${n} ${n === 1 ? "kartę" : "karty"}`;
  const cost = pay.kind === "money" ? `${pay.n} rb` : pay.kind === "culture" ? `${kart(pay.n)} Kultury z ręki` : pay.kind === "card" ? `${kart(pay.n)} z ręki` : "nic";
  const eff = [
    effect.money && `+${effect.money} rb`,
    effect.pp && `+${effect.pp} PP`,
    effect.poverty && `${minus(effect.poverty)} Nędzy`,
    effect.tracks && `${effect.tracks} tory`,
  ].filter(Boolean).join(", ");
  return `${perm ? perm + "\n" : ""}Uruchom: płacisz ${cost} → ${eff}${flips ? "\nZużywa się: po uruchomieniu gaśnie, dopóki jej nie przykryjesz" : ""}`;
}

type Res = "money" | "pp" | "poverty" | "card" | "track";
/** A number with its resource icon: the same coin, star and patch the stats bar uses. */
function Ico({ k, n, c }: { k: Res; n: string | number; c?: Color }) {
  return (
    <span className={css.res}>
      {n}
      {k === "card" ? <i className={css.cardIco} style={c ? { borderColor: `var(--${c})` } : undefined} />
        : k === "track" ? <i className={css.railIco} />
        : <i className={`${fx[k]} ${css.ico}`} />}
    </span>
  );
}

/** The card's run as a small equation: what you pay → what you get. */
function Effect({ d, small }: { d: CardDef; small?: boolean }) {
  if (d.event) return <span className={css.effNote}>{small ? "strajk 8+ Nędzy" : "Zdarzenie: strajkują rody z 8+ Nędzy"}</span>;
  const perm = d.permanent && <span className={css.perm}>{small ? `∞ ${PERM[d.permanent][1]}` : <><b>Stale</b> {PERM[d.permanent][0]}</>}</span>;
  if (!d.run) return perm || (d.color === "nedza" ? <span className={css.effNote}>martwa karta</span> : null);
  const { pay, effect: e, flips } = d.run;
  return (
    <span className={css.effect}>
      {perm}
      <span className={css.eq}>
        {pay.kind === "money" && <Ico k="money" n={pay.n} />}
        {(pay.kind === "card" || pay.kind === "culture") && <Ico k="card" n={pay.n} c={pay.kind === "culture" ? "kultura" : undefined} />}
        <span className={css.arrow}>➜</span>
        {!!e.money && <Ico k="money" n={`+${e.money}`} />}
        {!!e.pp && <Ico k="pp" n={`+${e.pp}`} />}
        {!!e.poverty && <Ico k="poverty" n={minus(e.poverty)} />}
        {!!e.tracks && <Ico k="track" n={`+${e.tracks}`} />}
        {flips && small && <span className={css.flipMark}>↻</span>}
      </span>
      {flips && !small && <span className={css.flips}>↻ zużywa się</span>}
    </span>
  );
}

function Card({ d, uid, selected, dim, onClick, small, planned }: { d: CardDef; uid?: number; selected?: boolean; dim?: boolean; onClick?: () => void; small?: boolean; planned?: boolean }) {
  return (
    <button
      type="button"
      data-uid={uid}
      className={`${css.card} ${small ? css.small : ""} ${selected ? css.selected : ""} ${dim ? css.dim : ""} ${planned ? css.planned : ""}`}
      style={{ "--c": `var(--${d.color})` } as React.CSSProperties}
      onClick={onClick}
      disabled={!onClick}
      data-tip-title={d.name}
      data-tip-meta={[COLOR_NAME[d.color], `Epoka ${"I".repeat(d.era)}`, d.color !== "nedza" && `koszt ${d.cost} rb`, d.pp > 0 && `${d.pp} PP`].filter(Boolean).join(" · ")}
      data-tip={runText(d) || undefined}
      data-tip-note={d.about}
    >
      <span className={css.art} style={ART.has(d.id) ? { backgroundImage: `url(/cards/${d.id}.webp)` } : undefined}>
        <span className={css.era}>{"I".repeat(d.era)}</span>
        {d.color !== "nedza" && <span className={css.cost}>{d.cost}</span>}
      </span>
      <span className={css.cardName}>{d.name}</span>
      <span className={css.cardText}><Effect d={d} small={small} /></span>
      <span className={css.cardFoot}>
        <span>{COLOR_NAME[d.color]}</span>
        {d.pp > 0 && <span className={css.pp}>{d.pp} PP</span>}
      </span>
    </button>
  );
}

type Mode = "none" | "invest" | "take3" | "run" | "buy";

type BoardProps = {
  s: State;
  seat: number;
  onAction: (a: Action) => Promise<string | null> | string | null; // returns an error message or null
  onExit: () => void;
};

const FULL = { x: 0, y: 0, w: BOARD.w };
const AR = BOARD.h / BOARD.w;
const DECO_AT = [[-7.5, 1], [7.5, 1], [-7.5, -4], [7.5, -4]]; // spots around a district point for investment figures
 // the board is 6:5, the viewBox keeps that ratio while zooming

/** Pinch to zoom and drag to pan the map by changing the SVG viewBox. */
function usePanZoom() {
  const [v, setV] = useState(FULL);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const zoomed = v.w < FULL.w;

  const clamp = (x: number, y: number, w: number) => {
    w = Math.min(FULL.w, Math.max(FULL.w / 4, w));
    return { x: Math.min(FULL.w - w, Math.max(0, x)), y: Math.min((FULL.w - w) * AR, Math.max(0, y)), w };
  };
  const mid = () => {
    const a = [...pts.current.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
  };

  const handlers = {
    onPointerDown(e: RPointerEvent<SVGSVGElement>) {
      if (pts.current.size === 0) moved.current = false;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    },
    onPointerMove(e: RPointerEvent<SVGSVGElement>) {
      const prev = pts.current.get(e.pointerId);
      if (!prev) return;
      const r = e.currentTarget.getBoundingClientRect();
      const before = pts.current.size === 2 ? mid() : null;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (before) {
        const after = mid();
        moved.current = true;
        setV((o) => {
          // keep the map point under the fingers' midpoint under the new midpoint
          const px = o.x + ((before.x - r.left) * o.w) / r.width, py = o.y + ((before.y - r.top) * o.w * AR) / r.height;
          const w = Math.min(FULL.w, Math.max(FULL.w / 4, (o.w * before.d) / Math.max(after.d, 1)));
          return clamp(px - ((after.x - r.left) * w) / r.width, py - ((after.y - r.top) * w * AR) / r.height, w);
        });
      } else if (pts.current.size === 1 && zoomed) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
        setV((o) => clamp(o.x - (dx * o.w) / r.width, o.y - (dy * o.w * AR) / r.height, o.w));
      }
    },
    onPointerUp(e: RPointerEvent<SVGSVGElement>) { pts.current.delete(e.pointerId); },
    onPointerCancel(e: RPointerEvent<SVGSVGElement>) { pts.current.delete(e.pointerId); },
    // a drag or pinch must not also buy the district under the finger
    onClickCapture(e: React.MouseEvent) { if (moved.current) { e.stopPropagation(); moved.current = false; } },
  };
  return { viewBox: `${v.x} ${v.y} ${v.w} ${v.w * AR}`, zoomed, reset: () => setV(FULL), handlers };
}

export function Board({ s, seat, onAction, onExit }: BoardProps) {
  const [mode, setMode] = useState<Mode>("none");
  const zoom = usePanZoom();
  const [anim, setAnim] = useAnimPref();
  const [sound, setSoundOn] = useSoundPref();
  useFxPlayer(s, anim);
  const [error, setError] = useState("");
  // invest
  const [plays, setPlays] = useState<{ card: number; discard?: number; onto?: number }[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  // the Imperium stack the picked card will cover (it can be chosen before the discard)
  const [aim, setAim] = useState<number | undefined>();
  // take3
  const [sources, setSources] = useState<("deck" | number)[]>([]);
  // run: stack index -> chosen tracks
  const [acts, setActs] = useState<Record<number, string[]>>({});
  const [trackStack, setTrackStack] = useState<number | null>(null);
  // run: stack index -> hand cards discarded to pay for it (pre-filled with the weakest, Nędza first)
  const [pays, setPays] = useState<Record<number, number[]>>({});
  // discard
  const [toDiscard, setToDiscard] = useState<number[]>([]);
  // side panel: an opponent's empire (seat), the log or the rules
  const [drawer, setDrawer] = useState<number | "log" | "help" | null>(null);
  // phone portrait shows one of board / market / empire at a time (tabs at the bottom)
  const [view, setView] = useState<"board" | "market" | "empire">("board");

  const reset = () => {
    setMode("none");
    setPlays([]);
    setPick(null);
    setAim(undefined);
    setSources([]);
    setActs({});
    setPays({});
    setTrackStack(null);
    setToDiscard([]);
  };

  const act = async (a: Action) => {
    const err = await onAction(a);
    if (err) return setError(err);
    setError("");
    reset();
  };

  const placedTracks = useMemo(() => Object.values(acts).flat(), [acts]);

  const me = s.players[seat];
  const myTurn = s.current === seat && s.phase !== "over";
  const deco: Record<string, Color[]> = {};
  s.players.forEach((p, pi) => {
    const mine = DISTRICTS.filter((d) => s.owner[d.id] === pi);
    p.empire.forEach((st, i) => {
      const c = def(s, st.cards.at(-1)!).color;
      if (mine.length && c !== "nedza") (deco[mine[i % mine.length].id] ??= []).push(c);
    });
  });
  const usedInPlays = new Set(plays.flatMap((p) => [p.card, p.discard ?? -1]));
  const paidCards = new Set(Object.values(pays).flat());
  const runCost = (i: number) => {
    const c = def(s, me.empire[i].cards.at(-1)!).run?.pay;
    return c?.kind === "card" || c?.kind === "culture" ? c : null;
  };
  const fitsCost = (i: number, u: number) => runCost(i)?.kind === "card" || def(s, u).color === "kultura";
  // invest preview: the play a stack click applies to is the picked card, else the last finished play
  const curPlay = pick != null ? -1 : plays.findLastIndex((p) => !def(s, p.card).event);
  const hasCur = pick != null || curPlay >= 0;
  const plannedOn = (i: number) => (pick != null && aim === i ? pick : plays.find((p) => p.onto === i)?.card);
  const newStacks = [...plays.filter((p) => !def(s, p.card).event && p.onto == null).map((p) => p.card), ...(pick != null && aim == null ? [pick] : [])];
  const topName = (i: number) => def(s, me.empire[i].cards.at(-1)!).name;

  function clickHand(uid: number) {
    if (!s || !myTurn) return;
    if (s.phase === "discard") {
      setToDiscard((d) => (d.includes(uid) ? d.filter((x) => x !== uid) : [...d, uid]));
      return;
    }
    if (mode === "run") {
      // a chosen payment card goes back to the hand; a free card fills the first unpaid slot it fits
      const owner = Object.keys(pays).map(Number).find((k) => pays[k].includes(uid));
      setError("");
      if (owner != null) return setPays({ ...pays, [owner]: pays[owner].filter((x) => x !== uid) });
      const slot = Object.keys(pays).map(Number).find((k) => pays[k].length < runCost(k)!.n && fitsCost(k, uid));
      if (slot == null) return setError(Object.keys(pays).length ? "Ta karta nie pasuje do żadnej płatności. Najpierw kliknij kartę płatności, by ją zwolnić." : "Ta karta nie jest potrzebna do zapłaty.");
      return setPays({ ...pays, [slot]: [...pays[slot], uid] });
    }
    if (mode !== "invest") return;
    // clicking a card already used in a play takes that play back
    if (usedInPlays.has(uid)) return setPlays((p) => p.filter((x) => x.card !== uid && x.discard !== uid));
    const d = def(s, uid);
    setError("");
    if (pick == null) {
      if (d.event) setPlays((p) => [...p, { card: uid }]);
      else if (d.color !== "nedza") setPick(uid);
      return;
    }
    if (uid === pick) {
      setAim(undefined);
      return setPick(null);
    }
    if (d.color !== def(s, pick).color) return setError(`Odrzucana karta musi mieć ten sam kolor (${COLOR_NAME[def(s, pick).color]}).`);
    setPlays((p) => [...p, { card: pick, discard: uid, onto: aim }]);
    setPick(null);
    setAim(undefined);
  }

  function clickStack(i: number) {
    if (!s || !myTurn) return;
    if (mode === "invest") {
      // a stack already planned for a card goes back to untouched; otherwise the current card goes onto it
      const taken = plays.findIndex((p) => p.onto === i);
      if (taken >= 0) return setPlays((p) => p.map((x, k) => (k === taken ? { ...x, onto: undefined } : x)));
      if (pick != null) return setAim(aim === i ? undefined : i);
      if (curPlay >= 0) setPlays((p) => p.map((x, k) => (k === curPlay ? { ...x, onto: i } : x)));
      return;
    }
    if (mode !== "run") return;
    const st = me.empire[i];
    const d = def(s, st.cards[st.cards.length - 1]);
    if (!d.run || st.flipped || strikeBlocks(me, d, hasPerm(s, me, "noStrike"))) return;
    setActs((a) => {
      const n = { ...a };
      if (i in n) delete n[i];
      else n[i] = [];
      return n;
    });
    setTrackStack(d.run.effect.tracks && !(i in acts) ? i : null);
    const cost = runCost(i);
    if (i in acts) {
      const rest = { ...pays };
      delete rest[i];
      setPays(rest);
    } else if (cost) {
      setPays({ ...pays, [i]: cheapest(s, me.hand, cost.n, (u) => !paidCards.has(u) && fitsCost(i, u)) });
    }
  }

  function clickDistrict(id: string) {
    if (!s || !myTurn || s.phase !== "action") return;
    if (mode === "run" && trackStack != null) {
      const d = def(s, me.empire[trackStack].cards.at(-1)!);
      const cur = acts[trackStack] ?? [];
      if (cur.includes(id)) return setActs({ ...acts, [trackStack]: cur.filter((x) => x !== id) });
      if (cur.length >= (d.run?.effect.tracks ?? 0)) return;
      if (!canTrack(s, id, placedTracks)) return setError("Tu nie można położyć toru.");
      setActs({ ...acts, [trackStack]: [...cur, id] });
      return;
    }
    if (mode === "buy") act({ t: "buy", district: id });
  }

  function confirmRun() {
    if (!s) return;
    const list = Object.entries(acts).map(([k, tracks]) => ({ stack: Number(k), pay: pays[Number(k)], tracks: tracks.length ? tracks : undefined }));
    const unpaid = list.find((a) => a.pay && a.pay.length < runCost(a.stack)!.n);
    if (unpaid) return setError(`Wybierz w ręce kartę do odrzucenia za „${def(s, me.empire[unpaid.stack].cards.at(-1)!).name}”.`);
    act({ t: "run", acts: list });
  }

  const ranked = s.scores ? ranking(s, s.scores) : null;
  const live = s.scores ?? score(s);
  // Nędza every run adds: stacks + hand cards − own districts
  const growth = (pi: number, hand = s.players[pi].hand.length, stacks = s.players[pi].empire.length) => stacks + hand - ownedCount(s, pi);
  const ledger = myTurn ? ledgerRows() : [];

  /** The running account of the current move: what it costs, what it brings, and what follows from it. */
  function ledgerRows(): [string, string, "up" | "down" | undefined][] {
    const g = growth(seat);
    const sign = (n: number) => (n > 0 ? `+${n}` : minus(n));
    if (mode === "invest") {
      const real = plays.filter((p) => !def(s, p.card).event);
      if (!real.length) return [];
      const cost = real.reduce((n, p) => n + def(s, p.card).cost, 0);
      const pp = real.reduce((n, p) => n + def(s, p.card).pp, 0);
      const after = growth(seat, me.hand.length - real.length * 2, me.empire.length + real.filter((p) => p.onto == null).length);
      return [
        ["Płacisz", `${cost} rb`, "down"],
        ["Odrzucasz na Giełdę", `${real.length} ${real.length === 1 ? "kartę" : "karty"}`, undefined],
        ["PP z tych kart na koniec", `+${pp} PP`, "up"],
        ["Nędza przy każdym Uruchom", `${sign(g)} → ${sign(after)}`, after < g ? "up" : after > g ? "down" : undefined],
      ];
    }
    if (mode === "run") {
      const keys = Object.keys(acts).map(Number);
      if (!keys.length) return [["Nędza po uruchomieniu", sign(g), "down"]];
      let spend = 0, gain = 0, pp = 0, pov = me.poverty, cards = 0;
      for (const k of keys) {
        const r = def(s, me.empire[k].cards.at(-1)!).run!;
        if (r.pay.kind === "money") spend += r.pay.n;
        if (r.pay.kind === "card" || r.pay.kind === "culture") cards += r.pay.n;
        gain += r.effect.money ?? 0;
        pp += r.effect.pp ?? 0;
        pov = Math.max(0, pov + (r.effect.poverty ?? 0));
      }
      const grow = growth(seat, me.hand.length - cards);
      const end = Math.max(0, pov + grow);
      return [
        ["Płacisz", [spend && `${spend} rb`, cards && `${cards} ${cards === 1 ? "kartę" : "karty"} z ręki`].filter(Boolean).join(" + ") || "nic", "down"],
        ["Dostajesz", [gain && `+${gain} rb`, pp && `+${pp} PP`, pov < me.poverty && `${minus(pov - me.poverty)} Nędzy`].filter(Boolean).join(", ") || "—", "up"],
        [`Nędza po turze (stosy ${me.empire.length} + ręka ${me.hand.length - cards} − dzielnice ${ownedCount(s, seat)})`, `${me.poverty} → ${end}`, end > me.poverty ? "down" : "up"],
        ...(end >= STRIKE_AT && !me.strike ? [["Uwaga", `Strajk od ${STRIKE_AT} Nędzy`, "down"] as [string, string, "down"]] : []),
      ];
    }
    if (mode === "buy") {
      const prices = DISTRICTS.filter((d) => !canBuy(s, seat, d.id)).map((d) => landPrice(s, me, d.id));
      return [
        ["Masz", `${me.money} rb`, undefined],
        ["Ceny wolnych gruntów", prices.length ? `${Math.min(...prices)}–${Math.max(...prices)} rb` : "brak", "down"],
        ["Każda dzielnica", "−1 Nędzy przy Uruchom", "up"],
      ];
    }
    if (mode === "take3") return [["Nędza przy każdym Uruchom", `${sign(g)} → ${sign(g + Math.max(1, sources.length))}`, "down"]];
    return [
      ["Wynik, gdyby gra skończyła się teraz", `${live[seat].total} PP`, undefined],
      ["Nędza przy każdym Uruchom", sign(g), g > 0 ? "down" : "up"],
      ...(me.loans ? [["Weksle", `${me.loans} × −7 PP (spłata ${repayCost(s, me)} rb)`, "down"] as [string, string, "down"]] : []),
    ];
  }

  // the one main move of the moment, shown as the wax seal
  const primary: { label: string; run?: () => void } =
    s.phase === "over" ? { label: "Nowa gra", run: onExit }
    : !myTurn ? { label: "Ruch rywala" }
    : s.phase === "draw" ? { label: "Dobierz z talii", run: s.deck.length ? () => act({ t: "draw", from: "deck" }) : undefined }
    : s.phase === "discard" ? { label: "Odrzuć", run: me.hand.length - toDiscard.length === HAND_LIMIT ? () => act({ t: "discard", cards: toDiscard }) : undefined }
    : mode === "invest" ? { label: "Zatwierdź", run: plays.length ? () => act({ t: "invest", plays }) : undefined }
    : mode === "run" ? { label: "Uruchom", run: Object.keys(acts).length ? confirmRun : undefined }
    : mode === "take3" ? { label: "Weź karty", run: sources.length || !(s.deck.length > 0 || s.market.some((m) => m != null)) ? () => act({ t: "take3", from: sources }) : undefined }
    : mode === "buy" ? { label: "Wybierz dzielnicę" }
    : { label: "Wybierz akcję" };
  const handN = me.hand.length;

  // on a phone, jump to the panel the current step needs
  const drawing = myTurn && s.phase === "draw";
  useEffect(() => {
    if (mode === "run" || mode === "invest") setView("empire");
    else if (mode === "take3" || drawing) setView("market");
    else if (mode === "buy" || mode === "none") setView("board");
  }, [mode, drawing]);

  return (
    <main className={css.table} data-view={view}>
      <header className={css.top}>
        {s.players.map((p, i) => i !== seat && (
          <button
            key={i} type="button" className={`${css.plaque} ${css.opp} ${i === s.current ? css.turn : ""}`}
            onClick={() => setDrawer(drawer === i ? null : i)} aria-expanded={drawer === i}
            data-tip={`Pokaż Imperium: ${p.name}`}
          >
            <Portrait i={i} />
            <span className={css.who}>
              <span className={css.name}>{p.name}{p.strike && <em className={css.strike}>strajk</em>}</span>
              <Stats p={p} i={i} sc={live[i]} grow={growth(i)} />
            </span>
          </button>
        ))}
        <div className={`${css.plaque} ${css.round}`}>
          <b>Runda {Math.ceil(s.turnNo / s.players.length)}</b>
          <small>{s.finalTurns !== null ? "ostatnia kolejka!" : `talia: ${s.deck.length}`}</small>
        </div>
        <nav className={`${css.plaque} ${css.tools}`} aria-label="Menu">
          <button type="button" className={css.knob} onClick={() => setDrawer(drawer === "log" ? null : "log")} aria-expanded={drawer === "log"} aria-label="Kronika" data-tip="Kronika">K</button>
          <button type="button" className={css.knob} onClick={() => setDrawer(drawer === "help" ? null : "help")} aria-expanded={drawer === "help"} aria-label="Jak grać" data-tip="Jak grać">?</button>
          <button type="button" className={css.knob} onClick={() => setAnim(!anim)} aria-pressed={anim} aria-label="Animacje" data-tip={`Animacje: ${anim ? "wł." : "wył."}`}>{anim ? "A" : "a"}</button>
          <button type="button" className={css.knob} onClick={() => setSoundOn(!sound)} aria-pressed={sound} aria-label="Dźwięk" data-tip={`Dźwięk: ${sound ? "wł." : "wył."}`}>{sound ? "♪" : "–"}</button>
        </nav>
      </header>

      <aside className={css.left}>
        <div className={`${css.plaque} ${css.me} ${myTurn ? css.turn : ""}`}>
          <Portrait i={seat} big />
          <span className={css.who}>
            <span className={css.name}>{me.name}{me.strike && <em className={css.strike}>strajk</em>}</span>
            <Stats p={me} i={seat} sc={live[seat]} grow={growth(seat)} wide />
          </span>
        </div>
        <section className={`${css.plaque} ${css.empire}`} aria-label="Twoje Imperium">
          <h2 className={css.tab}>Twoje Imperium</h2>
          {me.empire.length === 0 && !newStacks.length && <p className={css.muted}>Jeszcze nic nie zbudowano. Zainwestuj kartę z ręki.</p>}
          <div className={css.stacks}>
            {me.empire.map((st, i) => {
              const d = def(s, st.cards.at(-1)!);
              const blocked = strikeBlocks(me, d, hasPerm(s, me, "noStrike"));
              const planned = mode === "invest" ? plannedOn(i) : undefined;
              const coverable = myTurn && mode === "invest" && st.placedTurn !== s.turnNo;
              const target = coverable && hasCur && planned == null;
              const clickable = myTurn && ((mode === "run" && d.run && !st.flipped && !blocked) || (coverable && (hasCur || planned != null)));
              return (
                <div key={i} className={`${css.stack} ${target ? css.target : ""}`} data-label={st.flipped ? "przykryj zużytą" : "przykryj"}>
                  {planned != null
                    ? <Card d={def(s, planned)} small planned onClick={() => clickStack(i)} />
                    : <Card d={d} uid={st.cards.at(-1)} small dim={st.flipped} selected={i in acts} onClick={clickable ? () => clickStack(i) : undefined} />}
                  {st.cards.length + (planned != null ? 1 : 0) > 1 && <span className={css.count}>×{st.cards.length + (planned != null ? 1 : 0)}</span>}
                  {blocked && <span className={css.blocked}>strajk</span>}
                </div>
              );
            })}
            {mode === "invest" && newStacks.map((u) => (
              <div key={`new${u}`} className={`${css.stack} ${css.ghost}`}><Card d={def(s, u)} small planned /></div>
            ))}
          </div>
        </section>
        <p className={`${css.plaque} ${css.lastLog}`}>{s.log.at(-1)}</p>
      </aside>

      <div className={css.center}>
        <div className={css.boardWrap}>
        {zoom.zoomed && <button type="button" className={css.unzoom} onClick={zoom.reset}>Cały plan</button>}
        <svg
          viewBox={zoom.viewBox} className={css.board} role="img" aria-label="Plan Łodzi"
          style={{ touchAction: zoom.zoomed ? "none" : "pan-y" }} {...zoom.handlers}
        >
          <Terrain />
          {DISTRICTS.map((d) => {
            const owner = s.owner[d.id];
            const buyable = myTurn && s.phase === "action" && mode === "buy" && !canBuy(s, seat, d.id);
            const trackable = mode === "run" && trackStack != null && canTrack(s, d.id, placedTracks);
            const chosen = placedTracks.includes(d.id);
            return (
              <g
                key={d.id}
                data-district={d.id}
                data-tip-title={d.name}
                data-tip-meta={owner != null ? `Grunt: ${s.players[owner].name}` : d.start ? "Wolny grunt · startowy" : "Wolny grunt"}
                data-tip={`Cena ${landPrice(s, me, d.id)} rb · ${d.cards} ${d.cards === 1 ? "karta" : "karty"} · ${d.pp} PP${d.town ? "\nMiasteczko: kupisz, gdy tor dojdzie do sąsiedniej dzielnicy." : ""}`}
                aria-label={d.name}
                className={`${css.district} ${buyable || trackable ? css.clickable : ""}`}
                style={owner != null ? ({ "--c": PLAYER_COLORS[owner] } as CSSProperties) : undefined}
                onClick={() => (buyable || trackable || chosen) && clickDistrict(d.id)}
                role={buyable || trackable ? "button" : undefined}
                tabIndex={buyable || trackable ? 0 : undefined}
                onKeyDown={(e) => e.key === "Enter" && clickDistrict(d.id)}
              >
                <polygon
                  points={CELLS[d.id].poly}
                  className={`${css.cell} ${owner != null ? css.owned : ""} ${chosen ? css.chosen : buyable || trackable ? css.ring : ""}`}
                />
              </g>
            );
          })}
          {/* adjacency only matters while laying track */}
          {mode === "run" && trackStack != null && DISTRICTS.flatMap((d) =>
            ADJ[d.id].filter((n) => n > d.id).map((n) => {
              const o = DISTRICT_BY_ID[n];
              return <line key={d.id + n} x1={d.x} y1={d.y} x2={o.x} y2={o.y} className={css.edge} />;
            }),
          )}
          {DISTRICTS.flatMap((d) => ADJ[d.id].filter((n) => n > d.id && s.tracks.includes(d.id) && s.tracks.includes(n)).map((n) => [d, DISTRICT_BY_ID[n]] as const))
            .map(([d, o], i) => {
              const path = `M${d.x} ${d.y}Q${(d.x + o.x) / 2 + (o.y - d.y) * 0.12} ${(d.y + o.y) / 2 - (o.x - d.x) * 0.12} ${o.x} ${o.y}`;
              return (
                <g key={d.id + o.id} pointerEvents="none">
                  <path d={path} className={css.trackBed} pathLength={1} />
                  <path d={path} className={css.trackTies} />
                  {/* every third line gets a tram running back and forth */}
                  {anim && i % 3 === 0 && (
                    <image href="/board/b/tram.webp" x={-2.5} y={-4} width={5} height={5}>
                      <animateMotion dur={`${7 + (i % 4)}s`} repeatCount="indefinite" path={path} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
                    </image>
                  )}
                </g>
              );
            })}
          {DISTRICTS.map((d) => {
            const owner = s.owner[d.id];
            const size = d.town ? 9 : 10;
            return (
              <g key={d.id} pointerEvents="none">
                {/* decoration only: each investment shows as a small figure in one of its owner's districts */}
                {deco[d.id]?.slice(0, DECO_AT.length).map((c, k) => (
                  <image key={k + c} href={`/board/b/${c}.webp`} x={d.x + DECO_AT[k][0] - 2.75} y={d.y + DECO_AT[k][1] - 5.5} width={5.5} height={5.5} className={css.rise} />
                ))}
                {owner != null && (
                  // the district's landmark rises when it is bought
                  <g key={owner} className={css.rise}>
                    <image href={`/board/b/${d.id}.webp`} x={d.x - size / 2} y={d.y - size + 1.5} width={size} height={size} preserveAspectRatio="xMidYMax meet" />
                    <circle cx={d.x + size / 2 - 1.2} cy={d.y - size + 3} r={1.1} fill={PLAYER_COLORS[owner]} className={css.flag} />
                  </g>
                )}
                {s.tracks.includes(d.id) && <circle cx={d.x} cy={d.y} r={0.9} className={css.trackDot} />}
              </g>
            );
          })}
          {/* names last, so no building hides them */}
          {DISTRICTS.map((d) => (
            <g key={d.id} pointerEvents="none">
              <rect x={d.x - d.name.length * 0.62 - 0.8} y={d.y + 2.6} width={d.name.length * 1.24 + 1.6} height={3} rx={0.6} className={css.plate} />
              <text x={d.x} y={d.y + 4.8} className={css.label}>{d.name}</text>
            </g>
          ))}
        </svg>
        </div>
      </div>

      <aside className={css.right}>
        <section className={`${css.plaque} ${css.market}`} aria-label="Giełda">
          <h2 className={css.tab}>Giełda</h2>
          <div className={css.slots} style={{ gridTemplateColumns: `repeat(${s.slots}, 1fr)` }}>
            {s.market.map((m, i) => {
              const canTake = myTurn && (s.phase === "draw" || (mode === "take3" && !sources.includes(i) && sources.length < 3));
              return m == null ? <div key={i} className={css.slot} /> : (
                <Card key={m} d={def(s, m)} uid={m} small selected={sources.includes(i)}
                  onClick={canTake ? () => (s.phase === "draw" ? act({ t: "draw", from: i }) : setSources([...sources, i])) : undefined} />
              );
            })}
          </div>
        </section>
        <div className={css.deckRow}>
          <button
            type="button" className={css.deck} data-bank
            disabled={!myTurn || !s.deck.length || !(s.phase === "draw" || (mode === "take3" && sources.length < 3 && sources.filter((x) => x === "deck").length < s.deck.length))}
            onClick={() => (s.phase === "draw" ? act({ t: "draw", from: "deck" }) : setSources([...sources, "deck"]))}
            aria-label="Talia" data-tip={`Talia: ${s.deck.length} kart`}
          >
            <span>{s.deck.length}</span>
            {sources.filter((x) => x === "deck").length > 0 && <small>wybrano {sources.filter((x) => x === "deck").length}</small>}
          </button>
          <div className={`${css.plaque} ${css.acts}`}>
            <h2 className={css.tab}>Akcja</h2>
            {myTurn && s.phase === "action" && mode === "none" ? (
              <div className={css.btns}>
                <button type="button" className={css.brass} onClick={() => setMode("invest")} data-tip-title="Inwestuj" data-tip={"Kosztuje: cenę karty (złota moneta w rogu) + drugą kartę tego samego koloru, odrzuconą na Giełdę.\nDaje: kartę w Imperium do uruchamiania i jej PP na koniec gry."}>Inwestuj</button>
                <button type="button" className={css.brass} onClick={() => setMode("buy")} data-tip-title="Kup grunt" data-tip={"Kosztuje: cenę dzielnicy w rb.\nDaje: karty z talii od razu, PP dzielnicy na koniec i −1 Nędzy przy każdym Uruchom."}>Kup grunt</button>
                <button type="button" className={css.brass} onClick={() => setMode("take3")} data-tip-title="Weź 3 karty" data-tip={"Kosztuje: nic.\nUwaga: każda karta w ręce to +1 Nędzy przy każdym Uruchom i na koniec gry."}>Weź 3 karty</button>
                <button type="button" className={css.brass} onClick={() => setMode("run")} disabled={!me.empire.length} data-tip-title="Uruchom" data-tip={`Płacisz to, co na kartach przed strzałką, dostajesz to, co za nią.\nPotem Nędza ${growth(seat) >= 0 ? "+" : ""}${growth(seat)} (stosy + karty w ręce − Twoje dzielnice).`}>Uruchom</button>
              </div>
            ) : myTurn && s.phase === "action" ? (
              <div className={css.btns}>
                <button type="button" className={css.brass} onClick={reset}>Anuluj</button>
              </div>
            ) : myTurn && s.phase === "draw" && me.loans > 0 ? (
              <div className={css.btns}>
                <button type="button" className={css.brass} onClick={() => act({ t: "repay" })} disabled={me.money < repayCost(s, me)}>
                  Spłać weksel ({repayCost(s, me)} rb)
                </button>
              </div>
            ) : (
              <p className={css.muted}>{s.phase === "over" ? "Gra skończona." : !myTurn ? `Ruch: ${s.players[s.current].name}…` : s.phase === "draw" ? "Najpierw dobierz kartę." : "Najpierw odrzuć karty."}</p>
            )}
          </div>
        </div>
        <section className={`${css.plaque} ${css.hint}`} aria-live="polite">
          <h2 className={css.tab}>Podpowiedź</h2>
          <p>
            {s.phase === "over" ? "Koniec gry. Wyniki są na stole."
              : !myTurn ? `Czekasz na ruch: ${s.players[s.current].name}.`
              : s.phase === "draw" ? "Dobierz kartę z talii albo z Giełdy."
              : s.phase === "discard" ? `Masz za dużo kart. Wybierz w ręce ${me.hand.length - HAND_LIMIT} do odrzucenia.`
              : mode === "none" ? "Wybierz jedną akcję na tę turę."
              : mode === "invest" ? (pick != null
                ? `Krok 2: kliknij w ręce drugą kartę koloru ${COLOR_NAME[def(s, pick).color]}, którą odrzucisz na Giełdę. ${aim != null ? `„${def(s, pick).name}” przykryje „${topName(aim)}”.` : me.empire.some((st) => st.placedTurn !== s.turnNo) ? "Chcesz przykryć stos w Imperium (np. zużytą kartę)? Kliknij podświetlony stos, teraz albo po odrzuceniu." : "Karta trafi na nowy stos w Imperium."}`
                : curPlay >= 0
                  ? `„${def(s, plays[curPlay].card).name}” ${plays[curPlay].onto != null ? `przykryje „${topName(plays[curPlay].onto!)}”` : "trafi na nowy stos"}. ${me.empire.length ? "Kliknij podświetlony stos w Imperium, by go nią przykryć (ponowne kliknięcie cofa). " : ""}Możesz zainwestować następną kartę albo zatwierdzić pieczęcią.`
                  : "Krok 1: kliknij w ręce kartę, którą chcesz zainwestować.")
              : mode === "run" ? (trackStack != null
                ? "Kliknij dzielnice na planie, aby położyć tory."
                : "Kliknij karty w Imperium, które chcesz uruchomić. Do zapłaty zaznaczam najsłabsze karty z ręki (Nędza pierwsza); kliknij zaznaczoną kartę w ręce, by ją zwolnić, i inną, by zapłacić nią.")
              : mode === "take3" ? "Wybierz do 3 kart z Giełdy lub talii."
              : `Kliknij podświetloną dzielnicę. Najedź na nią (na telefonie przytrzymaj), by zobaczyć cenę, karty i PP. Masz ${me.money} rb; jeśli grunt jest droższy, bank wypisze weksel (${LOAN} rb, spłata ${repayCost(s, me)} rb, niespłacony −7 PP).`}
          </p>
          {mode === "invest" && plays.length > 0 && <LoanWarning cost={plays.reduce((n, p) => n + def(s, p.card).cost, 0)} money={me.money} />}
          {mode === "run" && Object.keys(acts).length > 0 && (
            <LoanWarning
              cost={Object.keys(acts).reduce((n, k) => {
                const pay = def(s, me.empire[Number(k)].cards.at(-1)!).run?.pay;
                return n + (pay?.kind === "money" ? pay.n : 0);
              }, 0)}
              money={me.money}
            />
          )}
          {mode === "run" && Object.keys(pays).length > 0 && (
            <ul className={css.pending}>
              {Object.entries(pays).map(([k, paid]) => (
                <li key={k}>
                  {def(s, me.empire[Number(k)].cards.at(-1)!).name}: odrzucasz {paid.length ? paid.map((u) => def(s, u).name).join(", ") : "…"}
                  {paid.length < runCost(Number(k))!.n && ` (wybierz ${runCost(Number(k))!.kind === "culture" ? "kartę Kultury" : "kartę"})`}
                </li>
              ))}
            </ul>
          )}
          {mode === "invest" && plays.length > 0 && (
            <ul className={css.pending}>
              {plays.map((p, i) => (
                <li key={i}>
                  {def(s, p.card).name}
                  {p.discard != null && ` (odrzucasz: ${def(s, p.discard).name})`}
                  {!def(s, p.card).event && (p.onto != null ? ` → przykrywa „${topName(p.onto)}”` : " → nowy stos")}
                </li>
              ))}
            </ul>
          )}
          {ledger.length > 0 && (
            <dl className={css.ledger} aria-label="Rachunek">
              {ledger.map(([k, v, tone]) => <div key={k}><dt>{k}</dt><dd className={tone ? css[tone] : undefined}>{v}</dd></div>)}
            </dl>
          )}
          {error && <p className={css.error} role="alert">{error}</p>}
        </section>
        <div className={css.sealRow}>
          <button type="button" className={css.seal} onClick={primary.run} disabled={!primary.run}><span>{primary.label}</span></button>
        </div>
      </aside>

      <section className={css.hand} aria-label={`Ręka (${handN}/${HAND_LIMIT})`}>
        <span className={css.handCount}>Ręka {handN}/{HAND_LIMIT}</span>
        <div className={css.fan}>
          {me.hand.map((u, k) => {
            const o = k - (handN - 1) / 2;
            return (
              <div key={u} className={css.slotFan} style={{ "--o": o, "--n": handN } as React.CSSProperties}>
                <Card d={def(s, u)} uid={u} selected={u === pick || toDiscard.includes(u) || paidCards.has(u)} dim={usedInPlays.has(u)}
                  onClick={myTurn && (mode === "invest" || mode === "run" || s.phase === "discard") ? () => clickHand(u) : undefined} />
              </div>
            );
          })}
        </div>
      </section>

      <nav className={css.tabs} aria-label="Widok">
        {([["board", "Plan"], ["market", "Giełda"], ["empire", `Imperium (${me.empire.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
        ))}
      </nav>

      {drawer != null && (
        <div className={css.drawer} role="dialog" aria-label={drawer === "log" ? "Kronika" : drawer === "help" ? "Jak grać" : `Imperium: ${s.players[drawer].name}`}>
          <button type="button" className={css.close} onClick={() => setDrawer(null)} aria-label="Zamknij">×</button>
          {drawer === "log" ? (
            <>
              <h2>Kronika</h2>
              <ol className={css.log}>{s.log.slice(-30).reverse().map((l, i) => <li key={i}>{l}</li>)}</ol>
            </>
          ) : drawer === "help" ? <Help open /> : (
            <>
              <h2>Imperium: {s.players[drawer].name}</h2>
              {s.players[drawer].empire.length === 0 && <p className={css.muted}>Jeszcze nic nie zbudowano.</p>}
              <div className={css.stacks}>
                {s.players[drawer].empire.map((st, k) => (
                  <div key={k} className={css.stack}>
                    <Card d={def(s, st.cards.at(-1)!)} uid={st.cards.at(-1)} small dim={st.flipped} />
                    {st.cards.length > 1 && <span className={css.count}>×{st.cards.length}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {s.phase === "over" && ranked && (
        <div className={css.modal} role="dialog" aria-label="Koniec gry">
          <div className={`${css.plaque} ${css.final}`}>
            <h2>Koniec gry</h2>
            <p className={css.winner}>Wygrywa {s.players[ranked[0].player].name}</p>
            <table className={css.scores}>
              <thead><tr><th>Ród</th><th>Karty</th><th>Dzielnice</th><th>Tory</th><th>Żetony</th><th>Ruble</th><th>Weksle</th><th>Nędza</th><th>Razem</th></tr></thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.player}>
                    <td>{s.players[r.player].name}</td><td>{r.cards}</td><td>{r.districts}</td><td>{r.tracks}</td><td>{r.tokens}</td>
                    <td>{r.money}</td><td>{r.loans}</td><td>{r.povertyPenalty}</td><td><strong>{r.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className={css.seal} onClick={onExit}><span>Nowa gra</span></button>
          </div>
        </div>
      )}
    </main>
  );
}

function Portrait({ i, big }: { i: number; big?: boolean }) {
  return <span className={`${css.portrait} ${big ? css.big : ""}`} style={{ backgroundImage: `url(/ui/portrait-${i % 4}.webp)`, borderColor: PLAYER_COLORS[i] }} />;
}

function Stats({ p, i, sc, grow, wide }: { p: State["players"][number]; i: number; sc: Score; grow: number; wide?: boolean }) {
  const parts = [
    ["Karty w Imperium", sc.cards], ["Dzielnice", sc.districts], ["Tory", sc.tracks], ["Żetony PP", sc.tokens],
    [`Ruble (1 PP za ${MONEY_PER_PP} rb)`, sc.money], ["Weksle", sc.loans], ["Nędza", sc.povertyPenalty],
  ] as const;
  const ppTip = parts.filter(([, v]) => v).map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${minus(v)}`).join("\n") || "Na razie 0 PP.";
  return (
    <span className={`${css.stats} ${wide ? css.wide : ""}`}>
      <span data-res={`${i}-money`} data-tip-title={`${p.money} rb`} data-tip={`Na koniec gry 1 PP za każde ${MONEY_PER_PP} rb (teraz ${sc.money} PP${p.money % MONEY_PER_PP ? `, do kolejnego brakuje ${MONEY_PER_PP - (p.money % MONEY_PER_PP)} rb` : ""}).`}><i className={`${fx.money} ${css.ico}`} /><Count v={p.money} />{wide && " rb"}</span>
      <span data-res={`${i}-pp`} data-tip-title={`Wynik: ${sc.total} PP`} data-tip-meta="gdyby gra skończyła się teraz" data-tip={ppTip}><i className={`${fx.pp} ${css.ico}`} /><Count v={sc.total} />{wide && " PP"}</span>
      <span data-res={`${i}-poverty`} data-tip-title={`Nędza: ${p.poverty}`} data-tip={`Każde Uruchom: ${grow >= 0 ? "+" : ""}${minus(grow)} (stosy ${p.empire.length} + ręka ${p.hand.length} − dzielnice ${p.empire.length + p.hand.length - grow}).\nOd ${STRIKE_AT} wybucha Strajk.\nNa koniec: Nędza + karty w ręce, porównane z najbiedniejszym rodem; teraz ${sc.povertyPenalty ? `${minus(sc.povertyPenalty)} PP` : "bez kary"}.`}><i className={`${fx.poverty} ${css.ico}`} /><Count v={p.poverty} />{wide && " Nędzy"}</span>
      {(wide || p.loans > 0) && <span data-res={`${i}-loan`} data-tip-title={`Weksle: ${p.loans}`} data-tip={`Bank pożycza ${LOAN} rb, gdy brakuje rubli. Spłata na początku tury; każdy niespłacony to −7 PP.`}><i className={`${fx.loan} ${css.ico}`} /><Count v={p.loans} />{wide && " weksli"}</span>}
      <span data-tip-title={`Karty w ręce: ${p.hand.length}/${HAND_LIMIT}`} data-tip="Każda karta w ręce to +1 Nędzy przy każdym Uruchom i na koniec gry."><i className={css.cardIco} />{p.hand.length}</span>
    </span>
  );
}

/** Solo game against bots, played entirely in the browser. */
export default function Game() {
  const [s, setS] = useState<State | null>(null);

  // bots play on their own, with a short pause so moves are readable
  useEffect(() => {
    if (!s || s.phase === "over" || !s.players[s.current].bot) return;
    const t = setTimeout(() => setS(apply(s, botMove(s))), 1200);
    return () => clearTimeout(t);
  }, [s]);

  if (!s) return <Setup onStart={(players) => setS(newGame(players))} />;
  return (
    <Board
      s={s} seat={0} onExit={() => setS(null)}
      onAction={(a) => {
        try {
          setS(apply(s, a));
          return null;
        } catch (e) {
          if (e instanceof GameError) return e.message;
          throw e;
        }
      }}
    />
  );
}

function OnlineStart({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function create() {
    setBusy(true);
    const r = await fetch("/api/games", { method: "POST", body: JSON.stringify({ name }) });
    const j = await r.json();
    if (!r.ok) {
      setBusy(false);
      return setErr(j.error);
    }
    localStorage.setItem(`fabrykant:${j.id}`, j.token);
    location.href = `/gra/${j.id}`;
  }
  return (
    <>
      <button type="button" className={css.brass} onClick={create} disabled={busy}>Gra online</button>
      <p className={css.muted}>Dostaniesz link do pokoju, który wyślesz znajomym (2–4 graczy, wolne miejsca mogą zająć boty).</p>
      {err && <p className={css.error} role="alert">{err}</p>}
    </>
  );
}

function Setup({ onStart }: { onStart: (p: { name: string; bot?: BotLevel }[]) => void }) {
  const [name, setName] = useState("Ty");
  const [bots, setBots] = useState(2);
  const [level, setLevel] = useState<BotLevel>("medium");
  const botNames = ["Ród Scheiblerów", "Ród Poznańskich", "Ród Geyerów"];
  return (
    <main className={css.menu}>
      <div className={css.menuCol}>
        <header className={css.logo}>
          <h1>Fabrykant</h1>
          <p>Łódź 1820–1914</p>
        </header>
        <div className={`${css.plaque} ${css.setup}`}>
          <p>Zbuduj imperium, zanim miasto stanie się ziemią obiecaną.</p>
          <label>Twoje imię <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} /></label>
          <label>
            Przeciwnicy
            <select id="bots" value={bots} onChange={(e) => setBots(Number(e.target.value))}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            Poziom
            <select id="level" value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
              <option value="easy">Łatwy</option>
              <option value="medium">Średni</option>
              <option value="hard">Trudny</option>
            </select>
          </label>
          <button type="button" className={css.brass} onClick={() => onStart([{ name: name.trim() || "Ty" }, ...botNames.slice(0, bots).map((n) => ({ name: n, bot: level }))])}>
            Graj solo
          </button>
          <OnlineStart name={name} />
        </div>
        <Help />
      </div>
    </main>
  );
}

const SAMPLE = CARDS.find((c) => c.id === "geyer")!;

/** A real card with numbered pins, and what each part means in play. */
function CardGuide() {
  const pins: [string, string, string][] = [
    // [left, top] of the pin, just outside the card edge next to the part it explains, then the explanation
    ["-7%", "10%", "Epoka (I, II, III). Talia idzie od epoki I do III, więc z czasem przychodzą droższe i mocniejsze karty."],
    ["107%", "10%", "Koszt inwestycji w rublach. Płacisz go, gdy wykładasz kartę do Imperium (brakujące ruble pożyczy bank na weksel)."],
    ["107%", "62%", "Nazwa i ilustracja: prawdziwe miejsce lub zjawisko z Łodzi. Najedź na kartę (na telefonie przytrzymaj), by przeczytać jej historię."],
    ["-7%", "79%", "Działanie przy akcji Uruchom: przed strzałką to, co płacisz (kartka = karta z ręki, z niebieską ramką karta Kultury; moneta = ruble), za strzałką to, co dostajesz (moneta = ruble, gwiazda = PP, szara łata = Nędza, szyny = tory). „↻ Zużywa się” znaczy, że po użyciu karta gaśnie, dopóki nie przykryjesz jej nową. „Stale” działa bez uruchamiania."],
    ["-7%", "94%", "Kolor. Inwestując, odrzucasz drugą kartę tego samego koloru. Przemysł zarabia, ale stoi podczas Strajku; Władza daje PP i przywileje; Kultura zmniejsza Nędzę; Nędza to martwe karty."],
    ["107%", "94%", "Punkty Prestiżu, które karta da na koniec gry, jeśli leży w Twoim Imperium (także przykryta)."],
  ];
  return (
    <div className={css.guide}>
      <div className={css.guideCard} aria-hidden>
        <Card d={SAMPLE} />
        {pins.map(([x, y], i) => <span key={i} className={css.pin} style={{ left: x, top: y }}>{i + 1}</span>)}
      </div>
      <ol className={css.guideList}>{pins.map(([, , t], i) => <li key={i}>{t}</li>)}</ol>
    </div>
  );
}

function Help({ open }: { open?: boolean }) {
  return (
    <details className={css.help} open={open}>
      <summary>Jak grać</summary>
      <p><b>Karta</b> (przykład: {SAMPLE.name}):</p>
      <CardGuide />
      <p><b>Tura:</b> dobierz 1 kartę (talia lub Giełda), potem wykonaj jedną akcję.</p>
      <ul>
        <li><b>Inwestuj:</b> wyłóż kartę do Imperium. Za każdą odrzucasz kartę tego samego koloru i płacisz koszt w rublach.</li>
        <li><b>Kup grunt:</b> zajmij dzielnicę. Pierwsza musi być startowa (Stare Miasto, Nowe Miasto, Łódka), kolejne sąsiadują z zajętymi. Dostajesz karty i PP na koniec.</li>
        <li><b>Weź 3 karty</b> z talii lub Giełdy.</li>
        <li><b>Uruchom fabryki:</b> używasz kart z Imperium (ruble, PP, mniej Nędzy, tory). Gdy karta każe odrzucić kartę, sam wybierasz którą (dowolną, także kartę Nędzy; „kartę Kultury” tylko Kulturę). Potem dostajesz Nędzę: stosy + karty w ręce − Twoje dzielnice.</li>
      </ul>
      <p><b>Nędza</b> odejmuje PP na koniec. Gdy dojdzie do 15, wybucha <b>Strajk</b>: do końca Twojej następnej tury karty Przemysłu nie pracują (poza tymi, które zmniejszają Nędzę).</p>
      <p><b>Weksle:</b> gdy brakuje rubli, bank daje 10 rb. Spłata 15 rb na początku tury, niespłacony to −7 PP.</p>
      <p><b>Tory</b> (Dworzec, Tramwaj, Kolej) łączą dzielnice od Śródmieścia: +2 PP za Twoją dzielnicę z torem. Miasteczka (Zgierz, Pabianice, Aleksandrów, Stryków) kupisz dopiero, gdy tor dojdzie do sąsiedniej dzielnicy.</p>
      <p><b>Koniec:</b> gdy talia się skończy, każdy ma jeszcze jedną turę. Liczą się PP z kart, dzielnic, torów i żetonów, plus 1 PP za każde 5 rb. Wygrywa najwięcej PP.</p>
      <Prices />
    </details>
  );
}

const LAND = DISTRICTS.map((d) => d.price);

/** Every cost and every source of PP in one ledger, so nothing has to be guessed. */
function Prices() {
  const row = (what: React.ReactNode, cost: React.ReactNode) => <tr><th scope="row">{what}</th><td>{cost}</td></tr>;
  return (
    <>
      <p><b>Cennik</b></p>
      <table className={css.price}>
        <tbody>
          {row("Inwestycja", <>koszt karty (moneta w rogu, {Math.min(...CARDS.map((c) => c.cost || 99))}–{Math.max(...CARDS.map((c) => c.cost))} rb) + druga karta tego samego koloru</>)}
          {row("Grunt", <>{Math.min(...LAND)}–{Math.max(...LAND)} rb (cena w dymku dzielnicy)</>)}
          {row("Uruchom", <>to, co na karcie przed strzałką; potem Nędza + stosy + karty w ręce − Twoje dzielnice</>)}
          {row("Weź 3 karty", "za darmo, ale więcej kart w ręce to więcej Nędzy")}
          {row("Weksel", <>bank daje {LOAN} rb, gdy brakuje; spłata 15 rb (12 z Bankiem Handlowym) na początku tury; niespłacony −7 PP</>)}
        </tbody>
      </table>
      <p><b>Punkty na koniec gry</b></p>
      <table className={css.price}>
        <tbody>
          {row(<>Karty w Imperium</>, "PP z rogu karty, także przykrytej")}
          {row("Dzielnice", <>PP dzielnicy ({Math.min(...DISTRICTS.map((d) => d.pp))}–{Math.max(...DISTRICTS.map((d) => d.pp))})</>)}
          {row("Tor w Twojej dzielnicy", "+2 PP")}
          {row("Żetony PP", "z uruchomionych kart (gwiazda za strzałką)")}
          {row("Ruble", `+1 PP za każde ${MONEY_PER_PP} rb`)}
          {row("Niespłacony weksel", "−7 PP")}
          {row("Nędza", <>Nędza + karty w ręce minus wynik najbiedniejszego rodu: przewaga 1–2 to −{povertyPenalty(1)} PP, 3 to −{povertyPenalty(3)}, 4 to −{povertyPenalty(4)}, 5 to −{povertyPenalty(5)}, każda kolejna −2</>)}
        </tbody>
      </table>
      <p className={css.muted}>Najedź na swoje ruble, PP i Nędzę u góry, by zobaczyć, z czego się składają. Panel „Podpowiedź” liczy na bieżąco, co kosztuje i co da wybrana akcja.</p>
    </>
  );
}

function LoanWarning({ cost, money }: { cost: number; money: number }) {
  if (!cost) return null;
  const loans = Math.max(0, Math.ceil((cost - money) / LOAN));
  return (
    <p className={loans ? css.error : css.muted}>
      Koszt: {cost} rb (masz {money} rb).
      {loans > 0 && ` Zabraknie ${cost - money} rb: bank wypisze ${loans} ${loans === 1 ? "weksel" : "weksle"}, każdy niespłacony to −7 PP.`}
    </p>
  );
}
