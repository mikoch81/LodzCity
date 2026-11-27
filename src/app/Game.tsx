"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { botMove, cheapest } from "@/engine/ai";
import { ADJ, DISTRICTS, type CardDef, type Color } from "@/engine/data";
import {
  apply, canBuy, canTrack, def, GameError, HAND_LIMIT, hasPerm, landPrice, LOAN, newGame, ranking, repayCost, score, strikeBlocks,
  type Action, type BotLevel, type State,
} from "@/engine/engine";
import { ART } from "./art";
import { Count, useAnimPref, useFxPlayer, useSoundPref } from "./Fx";
import css from "./Game.module.css";
import fx from "./Fx.module.css";
import { Terrain } from "./Terrain";

const COLOR_NAME: Record<Color, string> = { przemysl: "Przemysł", wladza: "Władza", kultura: "Kultura", nedza: "Nędza" };
const PLAYER_COLORS = ["#d9a441", "#7fb2d9", "#c97a9a", "#8fc28a"];

function runText(d: CardDef): string {
  if (d.event) return "Zdarzenie: strajkują rody z 8+ Nędzy";
  if (d.permanent) {
    return {
      landDiscount: "Stale: grunty tańsze o 1 rb",
      loanRepay12: "Stale: spłata weksla 12 rb",
      ppPerIndustry: "Stale: +1 PP za każdą kartę Przemysłu",
      noStrike: "Stale: Twój Przemysł nie strajkuje",
    }[d.permanent] + (d.run ? " · " : "");
  }
  if (!d.run) return d.color === "nedza" ? "Martwa karta" : "";
  const { pay, effect, flips } = d.run;
  const cost = pay.kind === "money" ? `${pay.n} rb` : pay.kind === "culture" ? `${pay.n} karta Kultury` : pay.kind === "card" ? `${pay.n} karta` : "";
  const eff = [
    effect.money && `+${effect.money} rb`,
    effect.pp && `+${effect.pp} PP`,
    effect.poverty && `${effect.poverty} Nędzy`,
    effect.tracks && `${effect.tracks} tory`,
  ].filter(Boolean).join(", ");
  return `${cost} → ${eff}${flips ? " (zużywa się)" : ""}`;
}

function Card({ d, uid, selected, dim, onClick, small }: { d: CardDef; uid?: number; selected?: boolean; dim?: boolean; onClick?: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      data-uid={uid}
      className={`${css.card} ${small ? css.small : ""} ${selected ? css.selected : ""} ${dim ? css.dim : ""}`}
      style={{ "--c": `var(--${d.color})` } as React.CSSProperties}
      onClick={onClick}
      disabled={!onClick}
      title={`${d.name}: ${runText(d)}${d.about ? `\n\n${d.about}` : ""}`}
    >
      <span className={css.art} style={ART.has(d.id) ? { backgroundImage: `url(/cards/${d.id}.webp)` } : undefined}>
        <span className={css.era}>{"I".repeat(d.era)}</span>
        {d.color !== "nedza" && <span className={css.cost}>{d.cost}</span>}
      </span>
      <span className={css.cardName}>{d.name}</span>
      {!small && <span className={css.cardText}>{runText(d)}</span>}
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

const FULL = { x: -4, y: -4, w: 108 };

/** Pinch to zoom and drag to pan the map by changing the SVG viewBox. */
function usePanZoom() {
  const [v, setV] = useState(FULL);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const zoomed = v.w < FULL.w;

  const clamp = (x: number, y: number, w: number) => {
    w = Math.min(FULL.w, Math.max(FULL.w / 4, w));
    const max = FULL.x + FULL.w - w;
    return { x: Math.min(max, Math.max(FULL.x, x)), y: Math.min(max, Math.max(FULL.y, y)), w };
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
          const px = o.x + ((before.x - r.left) * o.w) / r.width, py = o.y + ((before.y - r.top) * o.w) / r.height;
          const w = Math.min(FULL.w, Math.max(FULL.w / 4, (o.w * before.d) / Math.max(after.d, 1)));
          return clamp(px - ((after.x - r.left) * w) / r.width, py - ((after.y - r.top) * w) / r.height, w);
        });
      } else if (pts.current.size === 1 && zoomed) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
        setV((o) => clamp(o.x - (dx * o.w) / r.width, o.y - (dy * o.w) / r.height, o.w));
      }
    },
    onPointerUp(e: RPointerEvent<SVGSVGElement>) { pts.current.delete(e.pointerId); },
    onPointerCancel(e: RPointerEvent<SVGSVGElement>) { pts.current.delete(e.pointerId); },
    // a drag or pinch must not also buy the district under the finger
    onClickCapture(e: React.MouseEvent) { if (moved.current) { e.stopPropagation(); moved.current = false; } },
  };
  return { viewBox: `${v.x} ${v.y} ${v.w} ${v.w}`, zoomed, reset: () => setV(FULL), handlers };
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
  // take3
  const [sources, setSources] = useState<("deck" | number)[]>([]);
  // run: stack index -> chosen tracks
  const [acts, setActs] = useState<Record<number, string[]>>({});
  const [trackStack, setTrackStack] = useState<number | null>(null);
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
    setSources([]);
    setActs({});
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
  const usedInPlays = new Set(plays.flatMap((p) => [p.card, p.discard ?? -1]));

  function clickHand(uid: number) {
    if (!s || !myTurn) return;
    if (s.phase === "discard") {
      setToDiscard((d) => (d.includes(uid) ? d.filter((x) => x !== uid) : [...d, uid]));
      return;
    }
    if (mode !== "invest" || usedInPlays.has(uid)) return;
    const d = def(s, uid);
    if (pick == null) {
      if (d.event) setPlays((p) => [...p, { card: uid }]);
      else if (d.color !== "nedza") setPick(uid);
      return;
    }
    if (uid === pick) return setPick(null);
    if (d.color !== def(s, pick).color) return setError("Odrzucana karta musi mieć ten sam kolor.");
    setPlays((p) => [...p, { card: pick, discard: uid }]);
    setPick(null);
  }

  function clickStack(i: number) {
    if (!s || !myTurn) return;
    if (mode === "invest" && plays.length) {
      // cover a stack with the most recently added play
      setPlays((p) => p.map((x, k) => (k === p.length - 1 && !def(s, x.card).event ? { ...x, onto: x.onto === i ? undefined : i } : x)));
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
    let hand = [...me.hand];
    const list = Object.entries(acts).map(([k, tracks]) => {
      const stack = Number(k);
      const d = def(s, me.empire[stack].cards.at(-1)!);
      const cost = d.run!.pay;
      let pay: number[] | undefined;
      if (cost.kind === "card" || cost.kind === "culture") {
        // shortcut: payment cards are picked automatically (cheapest first), let players choose if testers ask
        pay = cheapest(s, hand, cost.n, (u) => cost.kind === "card" || def(s, u).color === "kultura");
        hand = hand.filter((u) => !pay!.includes(u));
      }
      return { stack, pay, tracks: tracks.length ? tracks : undefined };
    });
    act({ t: "run", acts: list });
  }

  const ranked = s.scores ? ranking(s, s.scores) : null;
  const live = s.scores ?? score(s);

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
    if (mode === "run") setView("empire");
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
            title={`Imperium: ${p.name}`}
          >
            <Portrait i={i} />
            <span className={css.who}>
              <span className={css.name}>{p.name}{p.strike && <em className={css.strike}>strajk</em>}</span>
              <Stats p={p} i={i} total={live[i].total} />
            </span>
          </button>
        ))}
        <div className={`${css.plaque} ${css.round}`}>
          <b>Runda {Math.ceil(s.turnNo / s.players.length)}</b>
          <small>{s.finalTurns !== null ? "ostatnia kolejka!" : `talia: ${s.deck.length}`}</small>
        </div>
        <nav className={`${css.plaque} ${css.tools}`} aria-label="Menu">
          <button type="button" className={css.knob} onClick={() => setDrawer(drawer === "log" ? null : "log")} aria-expanded={drawer === "log"} title="Kronika">K</button>
          <button type="button" className={css.knob} onClick={() => setDrawer(drawer === "help" ? null : "help")} aria-expanded={drawer === "help"} title="Jak grać">?</button>
          <button type="button" className={css.knob} onClick={() => setAnim(!anim)} aria-pressed={anim} title={`Animacje: ${anim ? "wł." : "wył."}`}>{anim ? "A" : "a"}</button>
          <button type="button" className={css.knob} onClick={() => setSoundOn(!sound)} aria-pressed={sound} title={`Dźwięk: ${sound ? "wł." : "wył."}`}>{sound ? "♪" : "–"}</button>
        </nav>
      </header>

      <aside className={css.left}>
        <div className={`${css.plaque} ${css.me} ${myTurn ? css.turn : ""}`}>
          <Portrait i={seat} big />
          <span className={css.who}>
            <span className={css.name}>{me.name}{me.strike && <em className={css.strike}>strajk</em>}</span>
            <Stats p={me} i={seat} total={live[seat].total} wide />
          </span>
        </div>
        <section className={`${css.plaque} ${css.empire}`} aria-label="Twoje Imperium">
          <h2 className={css.tab}>Twoje Imperium</h2>
          {me.empire.length === 0 && <p className={css.muted}>Jeszcze nic nie zbudowano. Zainwestuj kartę z ręki.</p>}
          <div className={css.stacks}>
            {me.empire.map((st, i) => {
              const d = def(s, st.cards.at(-1)!);
              const blocked = strikeBlocks(me, d, hasPerm(s, me, "noStrike"));
              const clickable = myTurn && ((mode === "run" && d.run && !st.flipped && !blocked) || (mode === "invest" && plays.length > 0 && st.placedTurn !== s.turnNo));
              return (
                <div key={i} className={css.stack}>
                  <Card d={d} uid={st.cards.at(-1)} small dim={st.flipped} selected={i in acts || plays.at(-1)?.onto === i} onClick={clickable ? () => clickStack(i) : undefined} />
                  {st.cards.length > 1 && <span className={css.count}>×{st.cards.length}</span>}
                  {blocked && <span className={css.blocked}>strajk</span>}
                </div>
              );
            })}
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
          {DISTRICTS.flatMap((d) =>
            ADJ[d.id].filter((n) => n > d.id).map((n) => {
              const o = DISTRICTS.find((x) => x.id === n)!;
              const track = s.tracks.includes(d.id) && s.tracks.includes(n);
              return track ? (
                <g key={d.id + n}>
                  <line x1={d.x} y1={d.y} x2={o.x} y2={o.y} className={css.trackBed} />
                  <line x1={d.x} y1={d.y} x2={o.x} y2={o.y} className={css.trackLine} pathLength={1} />
                </g>
              ) : <line key={d.id + n} x1={d.x} y1={d.y} x2={o.x} y2={o.y} className={css.edge} />;
            }),
          )}
          {DISTRICTS.map((d) => {
            const owner = s.owner[d.id];
            const buyable = myTurn && s.phase === "action" && mode === "buy" && !canBuy(s, seat, d.id);
            const trackable = mode === "run" && trackStack != null && canTrack(s, d.id, placedTracks);
            const chosen = placedTracks.includes(d.id);
            return (
              <g
                key={d.id}
                data-district={d.id}
                className={`${css.district} ${buyable || trackable ? css.clickable : ""}`}
                onClick={() => (buyable || trackable || chosen) && clickDistrict(d.id)}
                role={buyable || trackable ? "button" : undefined}
                tabIndex={buyable || trackable ? 0 : undefined}
                onKeyDown={(e) => e.key === "Enter" && clickDistrict(d.id)}
              >
                <title>{`${d.name}: ${landPrice(s, me, d.id)} rb, ${d.cards} karty, ${d.pp} PP${d.town ? " (miasteczko, wymaga toru)" : ""}`}</title>
                <circle
                  cx={d.x} cy={d.y} r={d.town ? 4.2 : 3.4}
                  fill={owner == null ? (d.town ? "#1d1714a0" : "#1d171450") : PLAYER_COLORS[owner]}
                  className={chosen ? css.chosen : buyable || trackable ? css.ring : undefined}
                />
                {owner != null && (
                  // a family's tenement drops onto bought land
                  <path className={css.house} d={`M${d.x - 1.6} ${d.y + 1.4}v-2.2l1.6-1.4 1.6 1.4v2.2z`} />
                )}
                {s.tracks.includes(d.id) && <rect x={d.x - 1.2} y={d.y - 1.2} width={2.4} height={2.4} className={css.trackDot} />}
                {/* name on a translucent plate so it reads on the photo */}
                <rect x={d.x - d.name.length * 0.62 - 0.8} y={d.y + 4.3} width={d.name.length * 1.24 + 1.6} height={3} rx={0.6} className={css.plate} />
                <text x={d.x} y={d.y + 6.5} className={css.label}>{d.name}</text>
              </g>
            );
          })}
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
            title="Talia"
          >
            <span>{s.deck.length}</span>
            {sources.filter((x) => x === "deck").length > 0 && <small>wybrano {sources.filter((x) => x === "deck").length}</small>}
          </button>
          <div className={`${css.plaque} ${css.acts}`}>
            <h2 className={css.tab}>Akcja</h2>
            {myTurn && s.phase === "action" && mode === "none" ? (
              <div className={css.btns}>
                <button type="button" className={css.brass} onClick={() => setMode("invest")}>Inwestuj</button>
                <button type="button" className={css.brass} onClick={() => setMode("buy")}>Kup grunt</button>
                <button type="button" className={css.brass} onClick={() => setMode("take3")}>Weź 3 karty</button>
                <button type="button" className={css.brass} onClick={() => setMode("run")} disabled={!me.empire.length}>Uruchom</button>
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
              : mode === "invest" ? (pick == null
                ? "Kliknij kartę w ręce, potem kartę tego samego koloru do odrzucenia. Kliknij swój stos w Imperium, by go przykryć."
                : `Teraz odrzuć kartę koloru ${COLOR_NAME[def(s, pick).color]}.`)
              : mode === "run" ? (trackStack != null
                ? "Kliknij dzielnice na planie, aby położyć tory."
                : "Kliknij karty w Imperium, które chcesz uruchomić. Karty do zapłaty dobiorę automatycznie.")
              : mode === "take3" ? "Wybierz do 3 kart z Giełdy lub talii."
              : `Kliknij podświetloną dzielnicę. Najedź na nią, by zobaczyć cenę, karty i PP. Masz ${me.money} rb; jeśli grunt jest droższy, bank wypisze weksel (${LOAN} rb, spłata ${repayCost(s, me)} rb, niespłacony −7 PP).`}
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
          {mode === "invest" && plays.length > 0 && (
            <ul className={css.pending}>
              {plays.map((p, i) => (
                <li key={i}>
                  {def(s, p.card).name}
                  {p.discard != null && ` (odrzucasz: ${def(s, p.discard).name})`}
                  {p.onto != null && ` na stos ${p.onto + 1}`}
                </li>
              ))}
            </ul>
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
                <Card d={def(s, u)} uid={u} selected={u === pick || toDiscard.includes(u)} dim={usedInPlays.has(u)}
                  onClick={myTurn && (mode === "invest" || s.phase === "discard") ? () => clickHand(u) : undefined} />
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
          ) : drawer === "help" ? <Help /> : (
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

function Stats({ p, i, total, wide }: { p: State["players"][number]; i: number; total: number; wide?: boolean }) {
  return (
    <span className={`${css.stats} ${wide ? css.wide : ""}`}>
      <span data-res={`${i}-money`} title="Ruble"><i className={`${fx.money} ${css.ico}`} /><Count v={p.money} />{wide && " rb"}</span>
      <span data-res={`${i}-pp`} title="Wynik, gdyby gra skończyła się teraz (z karami za Nędzę i weksle)"><i className={`${fx.pp} ${css.ico}`} /><Count v={total} />{wide && " PP"}</span>
      <span data-res={`${i}-poverty`} title="Nędza"><i className={`${fx.poverty} ${css.ico}`} /><Count v={p.poverty} />{wide && " Nędzy"}</span>
      {(wide || p.loans > 0) && <span data-res={`${i}-loan`} title="Weksle"><i className={`${fx.loan} ${css.ico}`} /><Count v={p.loans} />{wide && " weksli"}</span>}
      <span title="Karty na ręce"><i className={css.cardIco} />{p.hand.length}</span>
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

function Help() {
  return (
    <details className={css.help}>
      <summary>Jak grać</summary>
      <p><b>Tura:</b> dobierz 1 kartę (talia lub Giełda), potem wykonaj jedną akcję.</p>
      <ul>
        <li><b>Inwestuj:</b> wyłóż kartę do Imperium. Za każdą odrzucasz kartę tego samego koloru i płacisz koszt w rublach.</li>
        <li><b>Kup grunt:</b> zajmij dzielnicę. Pierwsza musi być startowa (Stare Miasto, Nowe Miasto, Łódka), kolejne sąsiadują z zajętymi. Dostajesz karty i PP na koniec.</li>
        <li><b>Weź 3 karty</b> z talii lub Giełdy.</li>
        <li><b>Uruchom fabryki:</b> używasz kart z Imperium (ruble, PP, mniej Nędzy, tory). Potem dostajesz Nędzę: stosy + karty w ręce − Twoje dzielnice.</li>
      </ul>
      <p><b>Nędza</b> odejmuje PP na koniec. Gdy dojdzie do 15, wybucha <b>Strajk</b>: do końca Twojej następnej tury karty Przemysłu nie pracują (poza tymi, które zmniejszają Nędzę).</p>
      <p><b>Weksle:</b> gdy brakuje rubli, bank daje 10 rb. Spłata 15 rb na początku tury, niespłacony to −7 PP.</p>
      <p><b>Tory</b> (Dworzec, Tramwaj, Kolej) łączą dzielnice od Śródmieścia: +2 PP za Twoją dzielnicę z torem. Miasteczka (Zgierz, Pabianice, Aleksandrów, Stryków) kupisz dopiero, gdy tor dojdzie do sąsiedniej dzielnicy.</p>
      <p><b>Koniec:</b> gdy talia się skończy, każdy ma jeszcze jedną turę. Liczą się PP z kart, dzielnic, torów i żetonów, plus 1 PP za każde 5 rb. Wygrywa najwięcej PP.</p>
    </details>
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
