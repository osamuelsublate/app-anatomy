// Geração de traço "desenhado à mão" (estilo Excalidraw), com jitter
// determinístico por elemento para o desenho não "fervilhar" a cada render.

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

function jitteredSegment(rand: () => number, x1: number, y1: number, x2: number, y2: number, amp: number): string {
  const j = () => (rand() - 0.5) * 2 * amp;
  const mx = (x1 + x2) / 2 + j();
  const my = (y1 + y2) / 2 + j();
  return `M ${(x1 + j()).toFixed(1)} ${(y1 + j()).toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${(x2 + j()).toFixed(1)} ${(y2 + j()).toFixed(1)}`;
}

/** Contorno de retângulo com traço trêmulo, em dois passes. */
export function roughRectOutline(x: number, y: number, w: number, h: number, seedKey: string): string {
  const rand = mulberry32(hashSeed(seedKey));
  const corners: Pt[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  const parts: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!;
      const c = corners[(i + 1) % 4]!;
      parts.push(jitteredSegment(rand, a[0], a[1], c[0], c[1], 1.6));
    }
  }
  return parts.join(" ");
}

/** Retângulo "limpo" arredondado, usado como preenchimento por baixo do contorno. */
export function fillRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** Linha com leve arqueado e tremor, em dois passes. */
export function roughLine(x1: number, y1: number, x2: number, y2: number, seedKey: string): string {
  const rand = mulberry32(hashSeed(seedKey));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const parts: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const bow = (rand() - 0.5) * Math.min(10, len * 0.06);
    const j = () => (rand() - 0.5) * 2.4;
    const mx = (x1 + x2) / 2 + nx * bow + j();
    const my = (y1 + y2) / 2 + ny * bow + j();
    parts.push(
      `M ${(x1 + j() * 0.5).toFixed(1)} ${(y1 + j() * 0.5).toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${(x2 + j() * 0.5).toFixed(1)} ${(y2 + j() * 0.5).toFixed(1)}`
    );
  }
  return parts.join(" ");
}

/** Ponta de seta (duas hastes) no ponto final, apontando de (x1,y1) para (x2,y2). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, seedKey: string, size = 13): string {
  const rand = mulberry32(hashSeed(seedKey + "#head"));
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const spread = 0.46;
  const parts: string[] = [];
  for (const s of [-1, 1]) {
    const a = ang + Math.PI + s * spread + (rand() - 0.5) * 0.08;
    const hx = x2 + Math.cos(a) * size;
    const hy = y2 + Math.sin(a) * size;
    parts.push(`M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${hx.toFixed(1)} ${hy.toFixed(1)}`);
  }
  return parts.join(" ");
}
