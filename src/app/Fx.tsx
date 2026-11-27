"use client";

import { useEffect, useRef, useState } from "react";
import type { Fx, State } from "@/engine/engine";
import css from "./Fx.module.css";
import { setSound, sfx } from "./sound";

const UNIT: Record<Fx["k"], string> = { money: "rb", poverty: "Nędzy", loan: "weksel", pp: "PP" };
const MAX_TOKENS: Record<Fx["k"], number> = { money: 8, poverty: 8, loan: 3, pp: 6 };

function center(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** An on/off setting remembered per browser (animations, sound). */
export function usePref(key: string, apply: (on: boolean) => void = () => {}): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`fabrykant:${key}`) !== "off";
      setOn(v);
      apply(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [on, (v) => {
    setOn(v);
    apply(v);
    try {
      localStorage.setItem(`fabrykant:${key}`, v ? "on" : "off");
    } catch {}
  }];
}

export const useAnimPref = () => usePref("anim");
export const useSoundPref = () => usePref("sound", setSound);

/**
 * Plays the last action's resource changes (s.fx): tokens fly between the card, district or bank and the player's counter.
 * Targets are found by data attributes: data-res="<player>-<kind>", data-uid, data-district, data-bank.
 */
export function useFxPlayer(s: State, enabled: boolean) {
  const last = useRef("");
  useEffect(() => {
    // online polling hands over a fresh copy of the same state, so play each action once
    const key = `${s.turnNo}|${s.phase}|${s.log.length}|${s.deck.length}|${JSON.stringify(s.fx ?? [])}`;
    if (key === last.current) return;
    last.current = key;
    if (!s.fx?.length) return;
    const still = !enabled || matchMedia("(prefers-reduced-motion: reduce)").matches;
    let delay = 0, whistled = false;
    for (const f of s.fx) {
      const counter = document.querySelector(`[data-res="${f.p}-${f.k}"]`);
      if (!counter) continue;
      const other =
        (f.card != null && document.querySelector(`[data-uid="${f.card}"]`)) ||
        (f.at && document.querySelector(`[data-district="${f.at}"]`)) ||
        document.querySelector("[data-bank]");
      play(f, counter, other || counter, delay, still);
      const at = delay / 1000;
      if (f.k === "money") sfx.coins(Math.abs(f.n), at);
      if (f.k === "loan" && f.n > 0) sfx.stamp(at);
      if (f.k === "poverty" && f.n > 0) sfx.poverty(at);
      if (f.k === "pp" && f.n > 0) sfx.pp(at);
      if (f.card != null && f.n > 0 && other) {
        if (!whistled) sfx.whistle(at);
        whistled = true;
        if (!still) smoke(other, delay);
      }
      delay += still ? 0 : 250;
    }
  }, [s, enabled]);
}

function play(f: Fx, counter: Element, other: Element, delay: number, still: boolean) {
  const layer = document.body;
  const to = center(counter);
  label(layer, f, to, delay, still);
  if (still) return;
  const [a, b] = f.n > 0 ? [center(other), to] : [to, center(other)];
  const n = Math.min(Math.abs(f.n), MAX_TOKENS[f.k]);
  for (let i = 0; i < n; i++) {
    const t = document.createElement("div");
    t.className = `${css.token} ${css[f.k]}`;
    t.setAttribute("aria-hidden", "true");
    layer.appendChild(t);
    // small sideways spread and an arc, so a pile of coins reads as a pile, not one dot
    const spread = (i - (n - 1) / 2) * 7;
    const midX = (a.x + b.x) / 2 + spread, midY = Math.min(a.y, b.y) - 40;
    const anim = t.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${midX}px, ${midY}px) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.x + spread / 2}px, ${b.y}px) scale(0.8)`, opacity: f.n > 0 ? 1 : 0 },
      ],
      { duration: 650, delay: delay + i * 55, easing: "cubic-bezier(.4,.1,.3,1)", fill: "both" },
    );
    anim.onfinish = () => t.remove();
  }
  counter.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.3)", color: f.k === "poverty" ? "#ff9b8a" : "#e8c66a" }, { transform: "scale(1)" }],
    { duration: 350, delay: delay + 600 },
  );
}

/** Factory chimney smoke rising from a card that just ran. */
function smoke(card: Element, delay: number) {
  const r = card.getBoundingClientRect();
  for (let i = 0; i < 4; i++) {
    const p = document.createElement("div");
    p.className = css.smoke;
    p.setAttribute("aria-hidden", "true");
    document.body.appendChild(p);
    const x = r.left + r.width * (0.3 + i * 0.13), y = r.top + 10;
    p.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${x + 4}px, ${y - 20}px) scale(1)`, opacity: 0.7, offset: 0.3 },
        { transform: `translate(${x + 16}px, ${y - 60}px) scale(2)`, opacity: 0 },
      ],
      { duration: 1400, delay: delay + i * 120, easing: "ease-out", fill: "both" },
    ).onfinish = () => p.remove();
  }
}

function label(layer: HTMLElement, f: Fx, at: { x: number; y: number }, delay: number, still: boolean) {
  const el = document.createElement("div");
  el.className = `${css.label} ${f.n > 0 === (f.k !== "poverty" && f.k !== "loan") ? css.good : css.bad}`;
  el.textContent = `${f.n > 0 ? "+" : "−"}${Math.abs(f.n)} ${UNIT[f.k]}`;
  el.setAttribute("aria-hidden", "true");
  layer.appendChild(el);
  const rise = still ? 0 : -28;
  el.animate(
    [
      { transform: `translate(${at.x}px, ${at.y}px)`, opacity: 0 },
      { transform: `translate(${at.x}px, ${at.y - 8}px)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${at.x}px, ${at.y + rise}px)`, opacity: 0 },
    ],
    { duration: 1400, delay: delay + (still ? 0 : 500), fill: "both" },
  ).onfinish = () => el.remove();
}

/** A number that rolls to its new value instead of jumping. */
export function Count({ v }: { v: number }) {
  const [shown, setShown] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const start = from.current;
    if (start === v) return;
    const t0 = performance.now() + 450; // wait for the tokens to land
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 400));
      const cur = Math.round(start + (v - start) * k);
      setShown(cur);
      from.current = cur;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <>{shown}</>;
}
