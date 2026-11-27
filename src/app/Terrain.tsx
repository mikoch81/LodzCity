// Photographic map under the district points: aerial view of the industrial city (Higgsfield), in public/board/<id>.webp.

export type MapStyle = "foto1" | "foto2" | "foto3";
export const MAP_STYLES: { id: MapStyle; name: string }[] = [
  { id: "foto1", name: "Lato" },
  { id: "foto2", name: "Złota godzina" },
  { id: "foto3", name: "Jesień" },
];

export function Terrain({ style }: { style: MapStyle }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <image href={`/board/${style}.webp`} x={-4} y={-4} width={108} height={108} preserveAspectRatio="xMidYMid slice" />
      {/* soft vignette so points and labels stay readable on a busy photo */}
      <defs>
        <radialGradient id="vignette">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <rect x={-4} y={-4} width={108} height={108} fill="url(#vignette)" />
    </g>
  );
}
