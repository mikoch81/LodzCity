// Small synthesized sound effects (Web Audio), so the game ships no audio files.
// shortcut: synthesized placeholders; swap for recorded samples if they sound too thin.
let ctx: AudioContext | null = null;
let on = true;

export function setSound(v: boolean) {
  on = v;
}

function ac() {
  if (!on || typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, glideTo?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(at: number, dur: number, vol: number, freq: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  f.type = "bandpass";
  f.frequency.value = freq;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  /** coins landing on a pile, one clink per coin (capped) */
  coins(n: number, at = 0) {
    for (let i = 0; i < Math.min(n, 6); i++) {
      tone(2400 + Math.random() * 900, at + 0.45 + i * 0.06, 0.12, "triangle", 0.06);
      tone(3900 + Math.random() * 600, at + 0.45 + i * 0.06, 0.08, "sine", 0.03);
    }
  },
  stamp(at = 0) {
    tone(90, at + 0.4, 0.18, "sine", 0.35, 50);
    noise(at + 0.4, 0.08, 0.25, 600);
  },
  poverty(at = 0) {
    tone(140, at + 0.45, 0.35, "sawtooth", 0.04, 90);
  },
  pp(at = 0) {
    tone(880, at + 0.45, 0.25, "sine", 0.07);
    tone(1320, at + 0.55, 0.3, "sine", 0.05);
  },
  whistle(at = 0) {
    tone(520, at, 0.9, "sine", 0.05, 560);
    tone(780, at, 0.9, "sine", 0.03, 840);
  },
  card() {
    noise(0, 0.12, 0.15, 2500);
  },
};
