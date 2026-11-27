// Landscape under the district map: rivers, forests and the Łódź Hills, drawn in board coordinates (0–100, north up).
// Positions are schematic, matched to where districts sit on our board, not surveyed.
import css from "./Terrain.module.css";

export type MapStyle = "sepia" | "kolor" | "noc";
export const MAP_STYLES: { id: MapStyle; name: string }[] = [
  { id: "sepia", name: "Sepia" },
  { id: "kolor", name: "Litografia" },
  { id: "noc", name: "Plan nocny" },
];

const RIVERS: { name: string; d: string; lx: number; ly: number }[] = [
  { name: "Bzura", d: "M66 13 Q56 15 48 11 T32 9 T-4 14", lx: 50, ly: 14.6 },
  { name: "Sokołówka", d: "M78 27 Q68 29 60 26 T44 27 T30 29 T-4 31", lx: 64, ly: 30.4 },
  { name: "Łódka", d: "M84 44 Q74 45 66 47 T54 49 T42 47 T28 49 T-4 47", lx: 68, ly: 44.6 },
  { name: "Jasień", d: "M84 58 Q76 57 68 60 T56 61 T42 63 T28 61 T-4 64", lx: 44, ly: 66.2 },
  { name: "Ner", d: "M60 95 Q48 92 40 94 T24 95 T-4 92", lx: 40, ly: 97.6 },
];

// forest patches: centre and radius; trees are scattered on a fixed pattern so every render matches
const FORESTS: { name: string; x: number; y: number; rx: number; ry: number }[] = [
  { name: "Las Łagiewnicki", x: 72, y: 12, rx: 10, ry: 6 },
  { name: "Lublinek", x: 18, y: 68, rx: 7, ry: 4 },
  { name: "Lasy zgierskie", x: 10, y: 22, rx: 7, ry: 7 },
  { name: "Las Wiączyński", x: 96, y: 48, rx: 5, ry: 8 },
];

const HILLS = [
  [80, 20], [86, 22], [92, 26], [78, 26], [84, 28], [94, 18], [90, 32], [82, 16],
];

function trees(f: (typeof FORESTS)[number]) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 26; i++) {
    // golden-angle spiral: even, natural-looking spread inside the ellipse
    const r = Math.sqrt((i + 0.5) / 26), a = i * 2.39996;
    out.push({ x: f.x + Math.cos(a) * r * f.rx, y: f.y + Math.sin(a) * r * f.ry });
  }
  return out;
}

export function Terrain({ style }: { style: MapStyle }) {
  return (
    <g className={`${css.terrain} ${css[style]}`} aria-hidden="true">
      {HILLS.map(([x, y], i) => (
        <g key={i} className={css.hill}>
          <path d={`M${x - 3} ${y + 1} Q${x} ${y - 2.4} ${x + 3} ${y + 1}`} />
          {[-1.8, -0.9, 0, 0.9, 1.8].map((dx) => <line key={dx} x1={x + dx} y1={y - 1.2 + Math.abs(dx) * 0.5} x2={x + dx * 1.3} y2={y + 0.6} />)}
        </g>
      ))}
      <text x={94} y={36} className={css.areaName}>Wzniesienia Łódzkie</text>
      {FORESTS.map((f) => (
        <g key={f.name} className={css.forest}>
          <ellipse cx={f.x} cy={f.y} rx={f.rx + 1} ry={f.ry + 1} className={css.forestArea} />
          {trees(f).map((t, i) => (
            <g key={i}>
              <circle cx={t.x} cy={t.y - 0.6} r={0.9} />
              <line x1={t.x} y1={t.y + 0.2} x2={t.x} y2={t.y + 1} />
            </g>
          ))}
          <text x={f.x} y={f.y + f.ry + 2.6} className={css.areaName}>{f.name}</text>
        </g>
      ))}
      {RIVERS.map((r) => (
        <g key={r.name}>
          <path d={r.d} className={css.riverBank} />
          <path d={r.d} className={css.river} />
          <text x={r.lx} y={r.ly} className={css.riverName}>{r.name}</text>
        </g>
      ))}
      <g className={css.rose} transform="translate(92 88)">
        <circle r={4.2} />
        <path d="M0 -5.5 L1 0 L0 5.5 L-1 0 Z M-5.5 0 L0 1 L5.5 0 L0 -1 Z" />
        <text y={-6.4}>N</text>
      </g>
    </g>
  );
}
