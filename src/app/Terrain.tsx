// Photographic map under the district points: aerial view of the industrial city at golden hour (Higgsfield).
export function Terrain() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <image href="/board/lodz.webp" x={-4} y={-4} width={108} height={108} preserveAspectRatio="xMidYMid slice" />
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
