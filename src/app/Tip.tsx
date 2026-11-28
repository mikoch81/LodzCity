"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import css from "./Tip.module.css";

/**
 * One styled tooltip for the whole app. Any element with data-tip (body), data-tip-title,
 * data-tip-meta or data-tip-note gets it: on hover or keyboard focus, and on a long press on touch screens.
 */
type T = { title?: string; meta?: string; body?: string; note?: string; r: DOMRect };

const SEL = "[data-tip],[data-tip-title]";
const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1;

export function Tip() {
  const [t, setT] = useState<T | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cur: Element | null = null;
    let press: ReturnType<typeof setTimeout> | undefined;
    let start = { x: 0, y: 0 };
    const show = (el: Element | null) => {
      if (el === cur) return;
      cur = el;
      if (!el) return setT(null);
      const a = (k: string) => el.getAttribute(k) || undefined;
      setPos(null);
      setT({ title: a("data-tip-title"), meta: a("data-tip-meta"), body: a("data-tip"), note: a("data-tip-note"), r: el.getBoundingClientRect() });
    };
    const find = (e: Event) => (e.target instanceof Element ? e.target.closest(SEL) : null);

    // a short delay, like a real tooltip; also lets a hovered hand card finish rising before it is measured
    let hover: ReturnType<typeof setTimeout> | undefined;
    let want: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = find(e);
      if (el === want) return;
      want = el;
      clearTimeout(hover);
      if (!el) return show(null);
      if (cur) show(null);
      hover = setTimeout(() => show(el), 220);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") { clearTimeout(hover); want = null; return show(null); }
      clearTimeout(press);
      show(null);
      const el = find(e);
      start = { x: e.clientX, y: e.clientY };
      // wait for the tapped card to finish rising before measuring it
      if (el) press = setTimeout(() => show(el), 450);
    };
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clearTimeout(press); };
    let settle: ReturnType<typeof setTimeout> | undefined;
    const up = () => {
      clearTimeout(press);
      // on release a hand card gets focus and rises; measure it again once it has moved
      const el = cur;
      if (el) settle = setTimeout(() => cur === el && setT((t) => t && { ...t, r: el.getBoundingClientRect() }), 250);
    };
    const focus = (e: FocusEvent) => { if (e.target instanceof Element && e.target.matches(":focus-visible")) show(find(e)); };
    const hide = () => show(null);
    const opts = { passive: true, capture: true };
    document.addEventListener("pointerover", over, opts);
    document.addEventListener("pointerdown", down, opts);
    document.addEventListener("pointermove", move, opts);
    document.addEventListener("pointerup", up, opts);
    document.addEventListener("pointercancel", up, opts);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, opts);
    window.addEventListener("resize", hide);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(press);
      clearTimeout(hover);
      clearTimeout(settle);
      document.removeEventListener("pointerover", over, opts);
      document.removeEventListener("pointerdown", down, opts);
      document.removeEventListener("pointermove", move, opts);
      document.removeEventListener("pointerup", up, opts);
      document.removeEventListener("pointercancel", up, opts);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, opts);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  // place above the element if it fits, else below; keep it on screen
  useLayoutEffect(() => {
    if (!t || !box.current) return;
    const z = zoom(), m = 8, gap = 12;
    const r = { left: t.r.left / z, right: t.r.right / z, top: t.r.top / z, bottom: t.r.bottom / z };
    const vw = innerWidth / z, vh = innerHeight / z;
    const w = box.current.offsetWidth, h = box.current.offsetHeight;
    const cx = (r.left + r.right) / 2;
    const left = Math.min(vw - w - m, Math.max(m, cx - w / 2));
    const below = r.top - gap - h < m && vh - r.bottom > r.top;
    const top = below ? Math.min(vh - h - m, r.bottom + gap) : Math.max(m, r.top - gap - h);
    setPos({ left, top, below, arrow: Math.min(w - 18, Math.max(18, cx - left)) });
  }, [t]);

  if (!t) return null;
  return (
    <div
      ref={box} role="tooltip" className={`${css.tip} ${pos?.below ? css.below : ""}`}
      style={pos ? { left: pos.left, top: pos.top, "--ax": `${pos.arrow}px` } as React.CSSProperties : { visibility: "hidden", left: 0, top: 0 }}
    >
      {t.title && <b className={css.title}>{t.title}</b>}
      {t.meta && <span className={css.meta}>{t.meta}</span>}
      {t.body && <span className={css.body}>{t.body}</span>}
      {t.note && <span className={css.note}>{t.note}</span>}
    </div>
  );
}
