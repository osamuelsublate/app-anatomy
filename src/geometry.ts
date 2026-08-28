import type { Diagram, DiagEdge, DiagNode, EdgeLineStyle, EdgePoint, PortSide } from "./types.js";

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 104;
const ANCHOR_GAP = 6;
export const GRID_SIZE = 24;

/** Largura efetiva de um nó (personalizada ou padrão). */
export function nodeWidth(node: Pick<DiagNode, "w">): number {
  return node.w ?? NODE_WIDTH;
}

/** Altura efetiva de um nó (personalizada ou padrão). */
export function nodeHeight(node: Pick<DiagNode, "h">): number {
  return node.h ?? NODE_HEIGHT;
}

export interface AlignmentGuide {
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
}

export interface DiagramBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function snapCoordinate(value: number, disabled = false, grid = GRID_SIZE): number {
  if (disabled || !Number.isFinite(value) || !Number.isFinite(grid) || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(
  point: { x: number; y: number },
  disabled = false,
  grid = GRID_SIZE,
): { x: number; y: number } {
  return {
    x: snapCoordinate(point.x, disabled, grid),
    y: snapCoordinate(point.y, disabled, grid),
  };
}

export function alignmentGuides(
  moving: DiagNode,
  nodes: readonly DiagNode[],
  tolerance = 4,
): AlignmentGuide[] {
  const result: AlignmentGuide[] = [];
  const movingWidth = nodeWidth(moving);
  const movingHeight = nodeHeight(moving);
  const movingX = [moving.x, moving.x + movingWidth / 2, moving.x + movingWidth];
  const movingY = [moving.y, moving.y + movingHeight / 2, moving.y + movingHeight];
  for (const node of nodes) {
    if (node.id === moving.id) continue;
    const otherWidth = nodeWidth(node);
    const otherHeight = nodeHeight(node);
    const otherX = [node.x, node.x + otherWidth / 2, node.x + otherWidth];
    const otherY = [node.y, node.y + otherHeight / 2, node.y + otherHeight];
    for (const x of movingX) {
      const match = otherX.find((candidate) => Math.abs(candidate - x) <= tolerance);
      if (match !== undefined && !result.some((guide) => guide.axis === "x" && guide.position === match)) {
        result.push({
          axis: "x",
          position: match,
          from: Math.min(moving.y, node.y) - 24,
          to: Math.max(moving.y + movingHeight, node.y + otherHeight) + 24,
        });
      }
    }
    for (const y of movingY) {
      const match = otherY.find((candidate) => Math.abs(candidate - y) <= tolerance);
      if (match !== undefined && !result.some((guide) => guide.axis === "y" && guide.position === match)) {
        result.push({
          axis: "y",
          position: match,
          from: Math.min(moving.x, node.x) - 24,
          to: Math.max(moving.x + movingWidth, node.x + otherWidth) + 24,
        });
      }
    }
  }
  return result;
}

export function screenToDiagram(
  viewport: Viewport,
  clientX: number,
  clientY: number,
  rect: RectLike,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

export function diagramToScreen(
  viewport: Viewport,
  x: number,
  y: number,
  rect: RectLike,
): { x: number; y: number } {
  return {
    x: x * viewport.zoom + viewport.x + rect.left,
    y: y * viewport.zoom + viewport.y + rect.top,
  };
}

export function zoomAround(
  viewport: Viewport,
  nextZoom: number,
  clientX: number,
  clientY: number,
  rect: RectLike,
): Viewport {
  const point = screenToDiagram(viewport, clientX, clientY, rect);
  const zoom = Math.min(3, Math.max(0.2, nextZoom));
  return {
    zoom,
    x: clientX - rect.left - point.x * zoom,
    y: clientY - rect.top - point.y * zoom,
  };
}

export function fitDiagram(
  diagram: Diagram,
  width: number,
  height: number,
  margin = 60,
): Viewport {
  const bounds = diagramBounds(diagram, margin);
  if (!bounds) return { x: 40, y: 40, zoom: 1 };
  const zoom = Math.max(0.2, Math.min(width / bounds.width, height / bounds.height, 1.3));
  return {
    zoom,
    x: (width - bounds.width * zoom) / 2 - bounds.minX * zoom,
    y: (height - bounds.height * zoom) / 2 - bounds.minY * zoom,
  };
}

export function anchorOnRect(node: DiagNode, targetX: number, targetY: number): { x: number; y: number } {
  const width = nodeWidth(node);
  const height = nodeHeight(node);
  const centerX = node.x + width / 2;
  const centerY = node.y + height / 2;
  const dx = targetX - centerX;
  const dy = targetY - centerY;

  if (dx === 0 && dy === 0) return { x: centerX, y: centerY };

  const scaleX = dx !== 0 ? width / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? height / 2 / Math.abs(dy) : Infinity;
  const edgeScale = Math.min(scaleX, scaleY);
  const distance = Math.hypot(dx, dy);
  const gapScale = Math.min(ANCHOR_GAP / distance, 0.2);

  return {
    x: centerX + dx * (edgeScale + gapScale),
    y: centerY + dy * (edgeScale + gapScale),
  };
}

// ---- Roteamento de conexões (portas por face, reto/ortogonal/curvo) ----

/** Distância que a linha ortogonal percorre perpendicular à face antes de dobrar. */
export const EDGE_JETTY = 24;
const ROUTE_PAD = 10;

const SIDE_NORMALS: Record<PortSide, EdgePoint> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function sideNormal(side: PortSide): EdgePoint {
  return SIDE_NORMALS[side];
}

function sideAxis(side: PortSide): "h" | "v" {
  return side === "left" || side === "right" ? "h" : "v";
}

/** Ponto de uma face em fração t (0..1) ao longo dela; t=0.5 é o meio. */
export function portPointAt(node: DiagNode, side: PortSide, t = 0.5): EdgePoint {
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  switch (side) {
    case "top": return { x: node.x + w * t, y: node.y };
    case "bottom": return { x: node.x + w * t, y: node.y + h };
    case "left": return { x: node.x, y: node.y + h * t };
    case "right": return { x: node.x + w, y: node.y + h * t };
  }
}

/** Face do nó mais próxima na direção de um ponto-alvo. */
export function nearestPortSide(node: DiagNode, targetX: number, targetY: number): PortSide {
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  const dx = targetX - (node.x + w / 2);
  const dy = targetY - (node.y + h / 2);
  const rx = dx / Math.max(1, w / 2);
  const ry = dy / Math.max(1, h / 2);
  if (Math.abs(rx) >= Math.abs(ry)) return rx >= 0 ? "right" : "left";
  return ry >= 0 ? "bottom" : "top";
}

export interface EdgeRoute {
  /** Polilinha completa do trajeto (âncoras nas pontas, cantos e waypoints no meio). */
  pts: EdgePoint[];
  style: EdgeLineStyle;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeRect(node: DiagNode, pad = 0): Rect {
  return {
    x: node.x - pad,
    y: node.y - pad,
    w: nodeWidth(node) + pad * 2,
    h: nodeHeight(node) + pad * 2,
  };
}

function nodeCenter(node: DiagNode): EdgePoint {
  return { x: node.x + nodeWidth(node) / 2, y: node.y + nodeHeight(node) / 2 };
}

/**
 * Deslocamento perpendicular para separar arestas paralelas entre o mesmo par
 * de nós (A→B, B→A, duplicatas). Calculado em orientação canônica do par para
 * que arestas em sentidos opostos se afastem em lados opostos.
 */
function parallelShift(edge: DiagEdge, allEdges: readonly DiagEdge[], from: DiagNode, to: DiagNode): EdgePoint {
  const group = allEdges.filter((item) =>
    (item.from === edge.from && item.to === edge.to) ||
    (item.from === edge.to && item.to === edge.from));
  if (group.length <= 1) return { x: 0, y: 0 };
  const index = group.findIndex((item) => item.id === edge.id);
  const spread = (Math.max(0, index) - (group.length - 1) / 2) * 28;
  const [a, b] = edge.from <= edge.to ? [from, to] : [to, from];
  const ac = nodeCenter(a);
  const bc = nodeCenter(b);
  const length = Math.hypot(bc.x - ac.x, bc.y - ac.y) || 1;
  return { x: ((bc.y - ac.y) / length) * spread, y: (-(bc.x - ac.x) / length) * spread };
}

/** Segmento ortogonal (h ou v) cruza o interior de um retângulo? */
function segmentCrossesRect(p: EdgePoint, q: EdgePoint, rect: Rect): boolean {
  if (Math.abs(p.x - q.x) < 0.01) {
    return p.x > rect.x && p.x < rect.x + rect.w &&
      Math.max(p.y, q.y) > rect.y && Math.min(p.y, q.y) < rect.y + rect.h;
  }
  return p.y > rect.y && p.y < rect.y + rect.h &&
    Math.max(p.x, q.x) > rect.x && Math.min(p.x, q.x) < rect.x + rect.w;
}

function pathCrossesRects(pts: readonly EdgePoint[], rects: readonly Rect[]): boolean {
  for (let index = 0; index < pts.length - 1; index += 1) {
    for (const rect of rects) {
      if (segmentCrossesRect(pts[index]!, pts[index + 1]!, rect)) return true;
    }
  }
  return false;
}

function pathLength(pts: readonly EdgePoint[]): number {
  let total = 0;
  for (let index = 0; index < pts.length - 1; index += 1) {
    total += Math.abs(pts[index + 1]!.x - pts[index]!.x) + Math.abs(pts[index + 1]!.y - pts[index]!.y);
  }
  return total;
}

/** Liga a→b em L, movendo primeiro ao longo do eixo preferido. */
function orthoCorners(a: EdgePoint, b: EdgePoint, preferAxis: "h" | "v"): { corners: EdgePoint[]; lastAxis: "h" | "v" } {
  if (Math.abs(a.x - b.x) < 0.5) return { corners: [], lastAxis: Math.abs(a.y - b.y) < 0.5 ? preferAxis : "v" };
  if (Math.abs(a.y - b.y) < 0.5) return { corners: [], lastAxis: "h" };
  return preferAxis === "h"
    ? { corners: [{ x: b.x, y: a.y }], lastAxis: "v" }
    : { corners: [{ x: a.x, y: b.y }], lastAxis: "h" };
}

/**
 * Liga a→b saindo pelo eixo `exitAxis` e chegando pelo eixo `arriveAxis`,
 * contornando os retângulos (blocos de origem/destino). Gera candidatos (rota
 * direta em L/Z e desvios pelas bordas) e escolhe o mais curto que não cruza.
 */
function orthoBetween(
  a: EdgePoint,
  b: EdgePoint,
  exitAxis: "h" | "v",
  arriveAxis: "h" | "v",
  rects: readonly Rect[],
): EdgePoint[] {
  const minX = Math.min(...rects.map((rect) => rect.x)) - ROUTE_PAD;
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w)) + ROUTE_PAD;
  const minY = Math.min(...rects.map((rect) => rect.y)) - ROUTE_PAD;
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h)) + ROUTE_PAD;
  const xs = [(a.x + b.x) / 2, minX, maxX];
  const ys = [(a.y + b.y) / 2, minY, maxY];
  const candidates: EdgePoint[][] = [];
  if (exitAxis === "h" && arriveAxis === "v") {
    candidates.push([{ x: b.x, y: a.y }]);
    for (const xm of xs) for (const ym of ys) candidates.push([{ x: xm, y: a.y }, { x: xm, y: ym }, { x: b.x, y: ym }]);
  } else if (exitAxis === "v" && arriveAxis === "h") {
    candidates.push([{ x: a.x, y: b.y }]);
    for (const ym of ys) for (const xm of xs) candidates.push([{ x: a.x, y: ym }, { x: xm, y: ym }, { x: xm, y: b.y }]);
  } else if (exitAxis === "h") {
    for (const xm of xs) candidates.push([{ x: xm, y: a.y }, { x: xm, y: b.y }]);
    for (const xm of xs) for (const ym of ys) candidates.push([{ x: xm, y: a.y }, { x: xm, y: ym }, { x: b.x, y: ym }, { x: b.x, y: b.y }]);
  } else {
    for (const ym of ys) candidates.push([{ x: a.x, y: ym }, { x: b.x, y: ym }]);
    for (const ym of ys) for (const xm of xs) candidates.push([{ x: a.x, y: ym }, { x: xm, y: ym }, { x: xm, y: b.y }]);
  }
  let best: EdgePoint[] | null = null;
  let bestScore = Infinity;
  for (const corners of candidates) {
    const pts = [a, ...corners, b];
    if (pathCrossesRects(pts, rects)) continue;
    const score = pathLength(pts) + corners.length * 20;
    if (score < bestScore) {
      best = corners;
      bestScore = score;
    }
  }
  return best ?? candidates[0] ?? [];
}

/** Remove pontos consecutivos (quase) idênticos e colineares redundantes. */
function simplify(pts: EdgePoint[]): EdgePoint[] {
  const result: EdgePoint[] = [];
  for (const pt of pts) {
    const last = result[result.length - 1];
    if (last && Math.abs(last.x - pt.x) < 0.01 && Math.abs(last.y - pt.y) < 0.01) continue;
    result.push(pt);
  }
  for (let index = result.length - 2; index > 0; index -= 1) {
    const [p, q, r] = [result[index - 1]!, result[index]!, result[index + 1]!];
    const collinear =
      (Math.abs(p.x - q.x) < 0.01 && Math.abs(q.x - r.x) < 0.01) ||
      (Math.abs(p.y - q.y) < 0.01 && Math.abs(q.y - r.y) < 0.01);
    if (collinear) result.splice(index, 1);
  }
  return result;
}

function selfLoopRoute(
  edge: DiagEdge,
  node: DiagNode,
  allEdges: readonly DiagEdge[],
  style: EdgeLineStyle,
  waypoints: readonly EdgePoint[],
): EdgeRoute {
  const fromSide = edge.fromSide ?? "right";
  const toSide = edge.toSide ?? "top";
  const group = allEdges.filter((item) => item.from === edge.from && item.to === edge.to);
  const index = Math.max(0, group.findIndex((item) => item.id === edge.id));
  const jetty = EDGE_JETTY + index * 16;
  if (fromSide === toSide) {
    const normal = sideNormal(fromSide);
    const s0 = portPointAt(node, fromSide, 0.3);
    const e0 = portPointAt(node, toSide, 0.7);
    const out = jetty * 1.5;
    const s1 = { x: s0.x + normal.x * out, y: s0.y + normal.y * out };
    const e1 = { x: e0.x + normal.x * out, y: e0.y + normal.y * out };
    return { pts: simplify([s0, s1, ...waypoints, e1, e0]), style };
  }
  const fromNormal = sideNormal(fromSide);
  const toNormal = sideNormal(toSide);
  const s0 = portPointAt(node, fromSide);
  const e0 = portPointAt(node, toSide);
  const s1 = { x: s0.x + fromNormal.x * jetty, y: s0.y + fromNormal.y * jetty };
  const e1 = { x: e0.x + toNormal.x * jetty, y: e0.y + toNormal.y * jetty };
  if (waypoints.length > 0) return { pts: simplify([s0, s1, ...waypoints, e1, e0]), style };
  let middle: EdgePoint[];
  if (sideAxis(fromSide) !== sideAxis(toSide)) {
    middle = [sideAxis(fromSide) === "h" ? { x: s1.x, y: e1.y } : { x: e1.x, y: s1.y }];
  } else if (sideAxis(fromSide) === "h") {
    const yOut = node.y - jetty;
    middle = [{ x: s1.x, y: yOut }, { x: e1.x, y: yOut }];
  } else {
    const xOut = node.x + nodeWidth(node) + jetty;
    middle = [{ x: xOut, y: s1.y }, { x: xOut, y: e1.y }];
  }
  return { pts: simplify([s0, s1, ...middle, e1, e0]), style };
}

/**
 * Calcula o trajeto completo de uma conexão: âncoras (porta fixa ou flutuante),
 * waypoints do usuário e — no estilo ortogonal — cantos que saem perpendiculares
 * à face e contornam os blocos de origem/destino.
 */
export function edgeRoute(
  edge: DiagEdge,
  nodeIndex: ReadonlyMap<string, DiagNode>,
  allEdges: readonly DiagEdge[] = [],
): EdgeRoute | null {
  const from = nodeIndex.get(edge.from);
  const to = nodeIndex.get(edge.to);
  if (!from || !to) return null;
  const style: EdgeLineStyle = edge.line ?? "straight";
  const waypoints = edge.points ?? [];
  if (edge.from === edge.to) return selfLoopRoute(edge, from, allEdges, style, waypoints);

  const fromCenter = nodeCenter(from);
  const toCenter = nodeCenter(to);
  const shift = waypoints.length > 0 ? { x: 0, y: 0 } : parallelShift(edge, allEdges, from, to);
  const aimStart = waypoints[0] ?? { x: toCenter.x + shift.x, y: toCenter.y + shift.y };
  const aimEnd = waypoints[waypoints.length - 1] ?? { x: fromCenter.x + shift.x, y: fromCenter.y + shift.y };

  if (style !== "ortho") {
    const start = edge.fromSide
      ? outsetPort(from, edge.fromSide, 6)
      : anchorOnRect(from, aimStart.x, aimStart.y);
    const end = edge.toSide
      ? outsetPort(to, edge.toSide, 6)
      : anchorOnRect(to, aimEnd.x, aimEnd.y);
    return { pts: simplify([start, ...waypoints, end]), style };
  }

  const fromSide = edge.fromSide ?? nearestPortSide(from, aimStart.x, aimStart.y);
  const toSide = edge.toSide ?? nearestPortSide(to, aimEnd.x, aimEnd.y);
  const s0 = slidePort(from, fromSide, edge.fromSide ? { x: 0, y: 0 } : shift);
  const e0 = slidePort(to, toSide, edge.toSide ? { x: 0, y: 0 } : shift);
  const fromNormal = sideNormal(fromSide);
  const toNormal = sideNormal(toSide);
  const s1 = { x: s0.x + fromNormal.x * EDGE_JETTY, y: s0.y + fromNormal.y * EDGE_JETTY };
  const e1 = { x: e0.x + toNormal.x * EDGE_JETTY, y: e0.y + toNormal.y * EDGE_JETTY };

  const pts: EdgePoint[] = [s0, s1];
  // A jetty sai ao longo do eixo da normal; a rota continua preferindo esse eixo.
  let axis: "h" | "v" = sideAxis(fromSide);
  let current: EdgePoint = s1;
  for (const waypoint of waypoints) {
    const { corners, lastAxis } = orthoCorners(current, waypoint, axis);
    pts.push(...corners, waypoint);
    axis = lastAxis;
    current = waypoint;
  }
  const rects = waypoints.length > 0 ? [] : [nodeRect(from, ROUTE_PAD - 2), nodeRect(to, ROUTE_PAD - 2)];
  if (waypoints.length > 0) {
    const arrive = sideAxis(toSide);
    const { corners } = orthoCorners(current, e1, axis === arrive ? (arrive === "h" ? "v" : "h") : axis);
    pts.push(...corners, e1);
  } else {
    pts.push(...orthoBetween(s1, e1, sideAxis(fromSide), sideAxis(toSide), rects), e1);
  }
  pts.push(e0);
  return { pts: simplify(pts), style };
}

/** Ponto no meio de uma face deslocado para fora do bloco. */
function outsetPort(node: DiagNode, side: PortSide, gap: number): EdgePoint {
  const normal = sideNormal(side);
  const base = portPointAt(node, side);
  return { x: base.x + normal.x * gap, y: base.y + normal.y * gap };
}

/** Desliza a âncora ao longo da face conforme o deslocamento paralelo. */
function slidePort(node: DiagNode, side: PortSide, shift: EdgePoint): EdgePoint {
  const base = portPointAt(node, side);
  if (shift.x === 0 && shift.y === 0) return base;
  const w = nodeWidth(node);
  const h = nodeHeight(node);
  if (sideAxis(side) === "h") {
    const limit = h / 2 - 14;
    return { x: base.x, y: base.y + Math.max(-limit, Math.min(limit, shift.y)) };
  }
  const limit = w / 2 - 14;
  return { x: base.x + Math.max(-limit, Math.min(limit, shift.x)), y: base.y };
}

/** Ponto na metade do comprimento de uma polilinha (posição do rótulo). */
export function polylineMidpoint(pts: readonly EdgePoint[]): EdgePoint {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  const half = pathLengthEuclidean(pts) / 2;
  let walked = 0;
  for (let index = 0; index < pts.length - 1; index += 1) {
    const a = pts[index]!;
    const b = pts[index + 1]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + segment >= half && segment > 0) {
      const t = (half - walked) / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += segment;
  }
  return pts[pts.length - 1]!;
}

function pathLengthEuclidean(pts: readonly EdgePoint[]): number {
  let total = 0;
  for (let index = 0; index < pts.length - 1; index += 1) {
    total += Math.hypot(pts[index + 1]!.x - pts[index]!.x, pts[index + 1]!.y - pts[index]!.y);
  }
  return total;
}

/** Índice do segmento da polilinha mais próximo de um ponto (para inserir waypoint). */
export function nearestSegmentIndex(pts: readonly EdgePoint[], x: number, y: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < pts.length - 1; index += 1) {
    const a = pts[index]!;
    const b = pts[index + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq));
    const distance = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

export function wrapLabel(label: string, max = 17, maxLines = 2): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current && `${current} ${word}`.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]!.slice(0, max - 1)}…`;
  }

  return lines;
}

export function diagramBounds(diagram: Diagram, margin: number): DiagramBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasFiniteNode = false;

  for (const node of diagram.nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;

    hasFiniteNode = true;
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;

    const nodeMaxX = node.x + nodeWidth(node);
    const nodeMaxY = node.y + nodeHeight(node);
    if (nodeMaxX > maxX) maxX = nodeMaxX;
    if (nodeMaxY > maxY) maxY = nodeMaxY;
  }

  if (!hasFiniteNode) return null;

  minX -= margin;
  minY -= margin;
  maxX += margin;
  maxY += margin;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
