"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { botMove, cheapest } from "@/engine/ai";
import { ADJ, DISTRICTS, type CardDef, type Color } from "@/engine/data";
import {
  apply, canBuy, canTrack, def, GameError, HAND_LIMIT, hasPerm, landPrice, LOAN, newGame, ranking, repayCost, score, strikeBlocks,
  type Action, type BotLevel, type State,
} from "@/engine/engine";
import { ART } from "./art";
import { Count, useAnimPref, useFxPlayer } from "./Fx";
import css from "./Game.module.css";

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

  return (
    <main className={css.game}>
      <header className={css.header}>
        <h1>Fabrykant</h1>
        <span>
          Runda {Math.ceil(s.turnNo / s.players.length)} · talia: {s.deck.length} kart
          {s.finalTurns !== null && " · ostatnia kolejka!"}
          {" · "}
          <button type="button" className={css.link} onClick={() => setAnim(!anim)} aria-pressed={anim}>
            Animacje: {anim ? "wł." : "wył."}
          </button>
        </span>
      </header>

      <section className={css.players}>
        {s.players.map((p, i) => (
          <div key={i} className={`${css.player} ${i === s.current ? css.active : ""}`} style={{ borderColor: PLAYER_COLORS[i] }}>
            <strong style={{ color: PLAYER_COLORS[i] }}>{p.name}</strong>
            <span data-res={`${i}-money`}><Count v={p.money} /> rb</span>
            <span data-res={`${i}-poverty`}>Nędza <Count v={p.poverty} />{p.strike ? " · STRAJK" : ""}</span>
            <span data-res={`${i}-loan`}>Weksle <Count v={p.loans} /></span>
            <span title="Wynik, gdyby gra skończyła się teraz (z karami za Nędzę i weksle)">Wynik teraz: <b data-res={`${i}-pp`}><Count v={live[i].total} /> PP</b></span>
            <span>Ręka {p.hand.length}</span>
          </div>
        ))}
      </section>

      <div className={css.middle}>
        <div className={css.boardWrap}>
        {zoom.zoomed && <button type="button" className={css.unzoom} onClick={zoom.reset}>Cały plan</button>}
        <svg
          viewBox={zoom.viewBox} className={css.board} role="img" aria-label="Plan Łodzi"
          style={{ touchAction: zoom.zoomed ? "none" : "pan-y" }} {...zoom.handlers}
        >
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
                  fill={owner == null ? (d.town ? "#a88f66" : "#c2ab82") : PLAYER_COLORS[owner]}
                  className={chosen ? css.chosen : buyable || trackable ? css.ring : undefined}
                />
                {owner != null && (
                  // a family's tenement drops onto bought land
                  <path className={css.house} d={`M${d.x - 1.6} ${d.y + 1.4}v-2.2l1.6-1.4 1.6 1.4v2.2z`} />
                )}
                {s.tracks.includes(d.id) && <rect x={d.x - 1.2} y={d.y - 1.2} width={2.4} height={2.4} className={css.trackDot} />}
                <text x={d.x} y={d.y + 6.4} className={css.label}>{d.name}</text>
              </g>
            );
          })}
        </svg>
        </div>

        <div className={css.side}>
          <h2>Giełda</h2>
          <div className={css.market} style={{ gridTemplateColumns: `repeat(${s.slots}, 1fr)` }}>
            {s.market.map((m, i) => {
              const canTake = myTurn && (s.phase === "draw" || (mode === "take3" && !sources.includes(i) && sources.length < 3));
              return m == null ? <div key={i} className={css.slot} /> : (
                <Card key={i} d={def(s, m)} uid={m} small selected={sources.includes(i)}
                  onClick={canTake ? () => (s.phase === "draw" ? act({ t: "draw", from: i }) : setSources([...sources, i])) : undefined} />
              );
            })}
          </div>
          <button
            type="button" className={css.deck} data-bank
            disabled={!myTurn || !s.deck.length || !(s.phase === "draw" || (mode === "take3" && sources.length < 3 && sources.filter((x) => x === "deck").length < s.deck.length))}
            onClick={() => (s.phase === "draw" ? act({ t: "draw", from: "deck" }) : setSources([...sources, "deck"]))}
          >
            Talia ({s.deck.length}){sources.filter((x) => x === "deck").length ? ` · wybrano ${sources.filter((x) => x === "deck").length}` : ""}
          </button>

          <div className={css.panel}>
            {s.phase === "over" && ranked ? (
              <>
                <h2>Koniec gry</h2>
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
                <button type="button" onClick={onExit}>Nowa gra</button>
              </>
            ) : !myTurn ? (
              <p>Ruch: {s.players[s.current].name}…</p>
            ) : s.phase === "draw" ? (
              <>
                <p>Dobierz kartę z talii albo z Giełdy.</p>
                {me.loans > 0 && (
                  <button type="button" onClick={() => act({ t: "repay" })} disabled={me.money < repayCost(s, me)}>
                    Spłać weksel ({repayCost(s, me)} rb)
                  </button>
                )}
              </>
            ) : s.phase === "discard" ? (
              <>
                <p>Masz za dużo kart. Wybierz {me.hand.length - HAND_LIMIT} do odrzucenia.</p>
                <button type="button" disabled={me.hand.length - toDiscard.length !== HAND_LIMIT} onClick={() => act({ t: "discard", cards: toDiscard })}>Odrzuć</button>
              </>
            ) : mode === "none" ? (
              <>
                <p>Wybierz jedną akcję na tę turę.</p>
                <div className={css.actions}>
                  <button type="button" onClick={() => setMode("invest")}>Inwestuj</button>
                  <button type="button" onClick={() => setMode("buy")}>Kup grunt</button>
                  <button type="button" onClick={() => setMode("run")} disabled={!me.empire.length}>Uruchom fabryki</button>
                  <button type="button" onClick={() => setMode("take3")}>Weź 3 karty</button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {mode === "invest" && (pick == null
                    ? "Kliknij kartę do zainwestowania, potem kartę tego samego koloru do odrzucenia. Kliknij swój stos, by go przykryć."
                    : `Teraz odrzuć kartę koloru ${COLOR_NAME[def(s, pick).color]}.`)}
                  {mode === "run" && (trackStack != null
                    ? "Kliknij dzielnice na planie, aby położyć tory."
                    : "Kliknij karty w Imperium, które chcesz uruchomić. Karty do zapłaty dobiorę automatycznie.")}
                  {mode === "take3" && "Wybierz do 3 kart z Giełdy lub talii."}
                  {mode === "buy" && `Kliknij podświetloną dzielnicę na planie. Najedź na nią, by zobaczyć cenę, karty i PP. Masz ${me.money} rb; jeśli grunt jest droższy, bank wypisze weksel (${LOAN} rb, spłata ${repayCost(s, me)} rb, niespłacony −7 PP).`}
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
                <div className={css.actions}>
                  <button type="button" onClick={reset}>Anuluj</button>
                  {mode === "invest" && <button type="button" disabled={!plays.length} onClick={() => act({ t: "invest", plays })}>Zatwierdź</button>}
                  {mode === "run" && <button type="button" disabled={!Object.keys(acts).length} onClick={confirmRun}>Uruchom</button>}
                  {mode === "take3" && <button type="button" disabled={!sources.length && (s.deck.length > 0 || s.market.some((m) => m != null))} onClick={() => act({ t: "take3", from: sources })}>Weź</button>}
                </div>
              </>
            )}
            {error && <p className={css.error} role="alert">{error}</p>}
          </div>
          <Help />
        </div>
      </div>

      <section>
        <h2>Twoje Imperium</h2>
        <div className={css.row}>
          {me.empire.length === 0 && <p className={css.muted}>Jeszcze nic nie zbudowano.</p>}
          {me.empire.map((st, i) => {
            const d = def(s, st.cards.at(-1)!);
            const blocked = strikeBlocks(me, d, hasPerm(s, me, "noStrike"));
            const clickable = myTurn && ((mode === "run" && d.run && !st.flipped && !blocked) || (mode === "invest" && plays.length > 0 && st.placedTurn !== s.turnNo));
            return (
              <div key={i} className={css.stack}>
                <Card d={d} uid={st.cards.at(-1)} dim={st.flipped} selected={i in acts || plays.at(-1)?.onto === i} onClick={clickable ? () => clickStack(i) : undefined} />
                {st.cards.length > 1 && <span className={css.muted}>stos: {st.cards.length}</span>}
                {blocked && <span className={css.error}>strajk</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Ręka ({me.hand.length}/{HAND_LIMIT})</h2>
        <div className={css.row}>
          {me.hand.map((u) => (
            <Card key={u} d={def(s, u)} uid={u} selected={u === pick || toDiscard.includes(u)} dim={usedInPlays.has(u)}
              onClick={myTurn && (mode === "invest" || s.phase === "discard") ? () => clickHand(u) : undefined} />
          ))}
        </div>
      </section>

      <section className={css.others}>
        {s.players.map((p, i) => i !== seat && (
          <div key={i}>
            <h3 style={{ color: PLAYER_COLORS[i] }}>Imperium: {p.name}</h3>
            <div className={css.row}>
              {p.empire.map((st, k) => <Card key={k} d={def(s, st.cards.at(-1)!)} uid={st.cards.at(-1)} small dim={st.flipped} />)}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Kronika</h2>
        <ol className={css.log}>
          {s.log.slice(-12).reverse().map((l, i) => <li key={i}>{l}</li>)}
        </ol>
      </section>
    </main>
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
      <button type="button" onClick={create} disabled={busy}>Załóż grę online</button>
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
    <main className={css.setup}>
      <h1>Fabrykant</h1>
      <p>Łódź, 1820. Zbuduj imperium, zanim miasto stanie się ziemią obiecaną.</p>
      <label>Twoje imię <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} /></label>
      <label>
        Przeciwnicy
        <select value={bots} onChange={(e) => setBots(Number(e.target.value))}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>
        Poziom
        <select value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
          <option value="easy">Łatwy</option>
          <option value="medium">Średni</option>
          <option value="hard">Trudny</option>
        </select>
      </label>
      <button type="button" onClick={() => onStart([{ name: name.trim() || "Ty" }, ...botNames.slice(0, bots).map((n) => ({ name: n, bot: level }))])}>
        Graj solo
      </button>
      <OnlineStart name={name} />
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
