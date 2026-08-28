import { ALIASES, CATALOG_VERSION } from "./catalog.js";
import type {
  Diagram,
  DiagramFile,
  DiagramMeta,
  DiagEdge,
  DiagNode,
  EdgeLineStyle,
  EdgePoint,
  PortSide,
} from "./types.js";

export const FORMAT_LIMITS = Object.freeze({
  inputCharacters: 2_000_000,
  nodes: 1_000,
  edges: 5_000,
  idCharacters: 64,
  defCharacters: 64,
  labelCharacters: 500,
  titleCharacters: 200,
  metadataCharacters: 100,
  coordinateMagnitude: 1_000_000,
  nodeMinWidth: 96,
  nodeMinHeight: 64,
  nodeMaxDimension: 2_000,
  edgePoints: 32,
});

export type DiagramCollection = "nodes" | "edges";

export type NormalizeWarningCode =
  | "discarded"
  | "invalid"
  | "limited"
  | "migrated"
  | "normalized"
  | "truncated";

export interface NormalizeWarningDetail {
  code: NormalizeWarningCode;
  path: string;
  message: string;
}

export interface NormalizeOptions {
  /**
   * IDs already present in the target document. Supplying this option enables
   * mandatory remapping of every imported ID, as required for insertion.
   */
  intoExisting?: Diagram;
  /** Remap every ID even when no target document is supplied. */
  remapIds?: boolean;
  /**
   * Optional deterministic ID source. Unsafe or duplicate values are ignored
   * and the built-in deterministic fallback is used.
   */
  createId?: (kind: "node" | "edge", sourceId: string, attempt: number) => string;
}

export interface NormalizeResult {
  ok: boolean;
  file: DiagramFile;
  diagram: Diagram;
  warnings: string[];
  /** Typed counterparts to `warnings`; the string list remains for compatibility. */
  warningDetails: NormalizeWarningDetail[];
  errors: string[];
  sourceVersion: 0 | 1 | null;
  migrated: boolean;
  /** Source ID to normalized ID. Edge keys are prefixed with `edge:`. */
  idMap: ReadonlyMap<string, string>;
}

export interface InsertDiagramResult extends NormalizeResult {
  /** The normalized template fragment, before it is appended to the target. */
  inserted: Diagram;
}

export const DEFAULT_DIAGRAM_TITLE = "Diagrama sem título";

export interface ImportResult {
  ok: boolean;
  file: DiagramFile;
  message?: string;
}

export interface DiagramFileSource {
  name: string;
  text(): Promise<string>;
}

export function prepareDiagramFile(
  file: DiagramFile,
  savedAt = new Date().toISOString(),
): DiagramFile {
  return {
    ...file,
    meta: {
      ...file.meta,
      title: normalizeDiagramTitle(file.meta.title.trim() || DEFAULT_DIAGRAM_TITLE),
      savedAt,
      catalogVersion: CATALOG_VERSION,
    },
  };
}

export function createEmptyDiagramFile(): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title: DEFAULT_DIAGRAM_TITLE, catalogVersion: CATALOG_VERSION },
    nodes: [],
    edges: [],
  };
}

export function importDiagramFile(input: string, filename: string): ImportResult {
  const result = normalize(input);
  if (!result.ok) {
    const details = result.errors.map((error) => {
      if (error.includes("invalid JSON")) return "o conteúdo não é um JSON válido";
      if (error.includes("expected a JSON object")) return "o conteúdo precisa ser um objeto JSON";
      if (error.includes("unsupported file version")) return "a versão do arquivo não é compatível";
      if (error.startsWith("nodes:")) return 'o campo "nodes" precisa ser uma lista';
      if (error.startsWith("edges:")) return 'o campo "edges" precisa ser uma lista';
      if (error.includes("exceeds")) return "o arquivo excede o tamanho permitido";
      return error;
    });
    return {
      ok: false,
      file: result.file,
      message: `Não consegui abrir esse arquivo. ${details.join("; ")}. O diagrama atual foi preservado.`,
    };
  }
  const title =
    result.file.meta.title.trim() ||
    filename.replace(/\.json$/i, "").trim() ||
    DEFAULT_DIAGRAM_TITLE;
  return {
    ok: true,
    file: {
      ...result.file,
      meta: { ...result.file.meta, title: normalizeDiagramTitle(title) },
    },
  };
}

export async function readDiagramFile(source: DiagramFileSource): Promise<ImportResult> {
  try {
    return importDiagramFile(await source.text(), source.name);
  } catch {
    return {
      ok: false,
      file: createEmptyDiagramFile(),
      message: "Não consegui ler esse arquivo. O diagrama atual foi preservado.",
    };
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalize a node tint to uppercase #RRGGBB, or null when unusable. */
export function normalizeDiagramNodeColor(value: unknown): string | null {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) return null;
  const hex = value.slice(1);
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return `#${full.toUpperCase()}`;
}

const EDGE_SIDES: ReadonlySet<string> = new Set(["top", "right", "bottom", "left"]);
const EDGE_LINES: ReadonlySet<string> = new Set(["straight", "ortho", "curved"]);

/** Normalize an edge anchor side, or null when unusable. */
export function normalizeDiagramEdgeSide(value: unknown): PortSide | null {
  return typeof value === "string" && EDGE_SIDES.has(value) ? (value as PortSide) : null;
}

/** Normalize an edge routing style, or null when unusable. */
export function normalizeDiagramEdgeLine(value: unknown): EdgeLineStyle | null {
  return typeof value === "string" && EDGE_LINES.has(value) ? (value as EdgeLineStyle) : null;
}

/** Limit a title exactly as v1 ingestion does. */
export function normalizeDiagramTitle(value: string): string {
  return value.slice(0, FORMAT_LIMITS.titleCharacters);
}

/** Limit a node or edge label exactly as v1 ingestion does. */
export function normalizeDiagramLabel(value: string): string {
  return value.slice(0, FORMAT_LIMITS.labelCharacters);
}

/**
 * Produce a finite v1 coordinate. Non-finite mutation input falls back to zero;
 * finite input is clamped to the representable range.
 */
export function normalizeDiagramCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(
    -FORMAT_LIMITS.coordinateMagnitude,
    Math.min(FORMAT_LIMITS.coordinateMagnitude, value),
  );
}

/**
 * Produce a finite v1 node dimension. Non-finite input falls back to the
 * minimum; finite input is clamped to the supported size range.
 */
export function normalizeDiagramNodeSize(value: number, axis: "width" | "height"): number {
  const min = axis === "width" ? FORMAT_LIMITS.nodeMinWidth : FORMAT_LIMITS.nodeMinHeight;
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(FORMAT_LIMITS.nodeMaxDimension, value));
}

/** Check IDs at mutation boundaries before adding them to a document. */
export function isSafeDiagramId(
  value: unknown,
  maxCharacters = FORMAT_LIMITS.idCharacters,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxCharacters &&
    SAFE_ID.test(value)
  );
}

/** Return a mutation ID unchanged, or reject it before it can enter model state. */
export function requireSafeDiagramId(
  value: string,
  maxCharacters = FORMAT_LIMITS.idCharacters,
): string {
  if (!isSafeDiagramId(value, maxCharacters)) {
    throw new RangeError(`diagram id must be 1-${maxCharacters} safe characters`);
  }
  return value;
}

/** Clamp an externally supplied collection count to the v1 range. */
export function normalizeDiagramCount(collection: DiagramCollection, value: number): number {
  const limit = FORMAT_LIMITS[collection];
  if (!Number.isFinite(value)) return 0;
  return Math.min(limit, Math.max(0, Math.trunc(value)));
}

/** Number of items that can still be added without v1 ingestion dropping any. */
export function remainingDiagramCapacity(
  diagram: Pick<Diagram, "nodes" | "edges">,
  collection: DiagramCollection,
): number {
  return FORMAT_LIMITS[collection] - normalizeDiagramCount(collection, diagram[collection].length);
}

/** Whether a mutation can add all requested items without exceeding v1 limits. */
export function hasDiagramCapacity(
  diagram: Pick<Diagram, "nodes" | "edges">,
  collection: DiagramCollection,
  additional = 1,
): boolean {
  return (
    Number.isInteger(additional) &&
    additional >= 0 &&
    additional <= remainingDiagramCapacity(diagram, collection)
  );
}

function emptyFile(): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title: "", catalogVersion: CATALOG_VERSION },
    nodes: [],
    edges: [],
  };
}

function diagramOf(file: DiagramFile): Diagram {
  return { nodes: file.nodes, edges: file.edges };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(
  value: unknown,
  fallback: string,
  max: number,
  path: string,
  warnings: string[],
): string {
  if (typeof value !== "string") {
    if (value !== undefined) warnings.push(`${path}: expected a string; using a safe default`);
    return fallback;
  }
  if (value.length <= max) return value;
  warnings.push(`${path}: truncated to ${max} characters`);
  if (max === FORMAT_LIMITS.titleCharacters) return normalizeDiagramTitle(value);
  if (max === FORMAT_LIMITS.labelCharacters) return normalizeDiagramLabel(value);
  return value.slice(0, max);
}

function warningDetail(message: string): NormalizeWarningDetail {
  const separator = message.indexOf(":");
  const path = separator < 0 ? "input" : message.slice(0, separator);
  let code: NormalizeWarningCode = "normalized";
  if (message.includes("discarded")) code = "discarded";
  else if (message.includes("truncated")) code = "truncated";
  else if (message.includes("limited")) code = "limited";
  else if (message.includes("migrated")) code = "migrated";
  else if (message.includes("expected") || message.includes("unsafe")) code = "invalid";
  return { code, path, message };
}

function detailsOf(warnings: string[]): NormalizeWarningDetail[] {
  return warnings.map(warningDetail);
}

function parseInput(input: unknown, errors: string[]): unknown {
  if (typeof input !== "string") return input;
  if (input.length > FORMAT_LIMITS.inputCharacters) {
    errors.push(`input: exceeds ${FORMAT_LIMITS.inputCharacters} characters`);
    return undefined;
  }
  try {
    return JSON.parse(input) as unknown;
  } catch {
    errors.push("input: invalid JSON");
    return undefined;
  }
}

function readMeta(raw: unknown, warnings: string[]): DiagramMeta {
  if (raw === undefined) return { title: "", catalogVersion: CATALOG_VERSION };
  if (!isRecord(raw)) {
    warnings.push("meta: expected an object; using defaults");
    return { title: "", catalogVersion: CATALOG_VERSION };
  }

  const meta: DiagramMeta = {
    title: boundedText(raw.title, "", FORMAT_LIMITS.titleCharacters, "meta.title", warnings),
    catalogVersion: CATALOG_VERSION,
  };
  if (raw.savedAt !== undefined) {
    meta.savedAt = boundedText(
      raw.savedAt,
      "",
      FORMAT_LIMITS.metadataCharacters,
      "meta.savedAt",
      warnings,
    );
  }
  if (raw.catalogVersion !== undefined) {
    meta.catalogVersion = boundedText(
      raw.catalogVersion,
      CATALOG_VERSION,
      FORMAT_LIMITS.metadataCharacters,
      "meta.catalogVersion",
      warnings,
    );
  }
  return meta;
}

function uniqueId(
  kind: "node" | "edge",
  sourceId: string,
  used: Set<string>,
  createId: NormalizeOptions["createId"],
): string {
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = createId?.(kind, sourceId, attempt);
    if (isSafeDiagramId(candidate) && !used.has(candidate)) return candidate;
  }

  const suffixRoom = Math.max(1, FORMAT_LIMITS.idCharacters - 2);
  const base = sourceId.slice(0, suffixRoom);
  for (let attempt = 2; ; attempt += 1) {
    const suffix = `-${attempt}`;
    const candidate = `${base.slice(0, FORMAT_LIMITS.idCharacters - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function normalizeNode(
  raw: unknown,
  index: number,
  warnings: string[],
): DiagNode | undefined {
  const path = `nodes[${index}]`;
  if (!isRecord(raw)) {
    warnings.push(`${path}: expected an object; discarded`);
    return undefined;
  }
  if (!isSafeDiagramId(raw.id)) {
    warnings.push(`${path}.id: unsafe or missing; node discarded`);
    return undefined;
  }
  if (!isSafeDiagramId(raw.def, FORMAT_LIMITS.defCharacters)) {
    warnings.push(`${path}.def: unsafe or missing; node discarded`);
    return undefined;
  }
  if (
    typeof raw.x !== "number" ||
    raw.x !== normalizeDiagramCoordinate(raw.x) ||
    typeof raw.y !== "number" ||
    raw.y !== normalizeDiagramCoordinate(raw.y)
  ) {
    warnings.push(`${path}: coordinates must be finite and bounded; node discarded`);
    return undefined;
  }

  const alias = Object.hasOwn(ALIASES, raw.def) ? ALIASES[raw.def] : undefined;
  if (alias !== undefined) warnings.push(`${path}.def: translated alias "${raw.def}" to "${alias}"`);
  const node: DiagNode = {
    id: raw.id,
    def: alias ?? raw.def,
    x: raw.x,
    y: raw.y,
    label: boundedText(
      raw.label,
      "",
      FORMAT_LIMITS.labelCharacters,
      `${path}.label`,
      warnings,
    ),
  };
  for (const [key, axis] of [["w", "width"], ["h", "height"]] as const) {
    const rawSize = raw[key];
    if (rawSize === undefined) continue;
    if (typeof rawSize !== "number" || !Number.isFinite(rawSize)) {
      warnings.push(`${path}.${key}: expected a finite number; discarded`);
      continue;
    }
    const size = normalizeDiagramNodeSize(rawSize, axis);
    if (size !== rawSize) warnings.push(`${path}.${key}: limited to the supported size range`);
    node[key] = size;
  }
  if (raw.color !== undefined) {
    const color = normalizeDiagramNodeColor(raw.color);
    if (color) node.color = color;
    else warnings.push(`${path}.color: expected a hex color; discarded`);
  }
  return node;
}

function normalizeEdge(
  raw: unknown,
  index: number,
  warnings: string[],
): DiagEdge | undefined {
  const path = `edges[${index}]`;
  if (!isRecord(raw)) {
    warnings.push(`${path}: expected an object; discarded`);
    return undefined;
  }
  if (
    !isSafeDiagramId(raw.id) ||
    !isSafeDiagramId(raw.from) ||
    !isSafeDiagramId(raw.to)
  ) {
    warnings.push(`${path}: unsafe or missing id/endpoint; edge discarded`);
    return undefined;
  }
  const edge: DiagEdge = {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    label: boundedText(
      raw.label,
      "",
      FORMAT_LIMITS.labelCharacters,
      `${path}.label`,
      warnings,
    ),
  };
  for (const key of ["fromSide", "toSide"] as const) {
    if (raw[key] === undefined) continue;
    const side = normalizeDiagramEdgeSide(raw[key]);
    if (side) edge[key] = side;
    else warnings.push(`${path}.${key}: expected top/right/bottom/left; discarded`);
  }
  if (raw.line !== undefined) {
    const line = normalizeDiagramEdgeLine(raw.line);
    if (line) edge.line = line;
    else warnings.push(`${path}.line: expected straight/ortho/curved; discarded`);
  }
  if (raw.points !== undefined) {
    if (!Array.isArray(raw.points)) {
      warnings.push(`${path}.points: expected an array; discarded`);
    } else {
      const points: EdgePoint[] = [];
      let invalid = 0;
      for (const item of raw.points) {
        if (
          isRecord(item) &&
          typeof item.x === "number" && item.x === normalizeDiagramCoordinate(item.x) &&
          typeof item.y === "number" && item.y === normalizeDiagramCoordinate(item.y)
        ) {
          points.push({ x: item.x, y: item.y });
        } else {
          invalid += 1;
        }
      }
      if (invalid > 0) warnings.push(`${path}.points: ${invalid} invalid item(s) discarded`);
      if (points.length > FORMAT_LIMITS.edgePoints) {
        warnings.push(`${path}.points: limited to the first ${FORMAT_LIMITS.edgePoints} items`);
        points.length = FORMAT_LIMITS.edgePoints;
      }
      if (points.length > 0) edge.points = points;
    }
  }
  return edge;
}

export function normalize(input: unknown, options: NormalizeOptions = {}): NormalizeResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const idMap = new Map<string, string>();
  const value = parseInput(input, errors);
  const fallback = emptyFile();

  if (!isRecord(value)) {
    if (errors.length === 0) errors.push("input: expected a JSON object");
    return {
      ok: false,
      file: fallback,
      diagram: diagramOf(fallback),
      warnings,
      warningDetails: detailsOf(warnings),
      errors,
      sourceVersion: null,
      migrated: false,
      idMap,
    };
  }

  let sourceVersion: 0 | 1 | null;
  if (value.version === undefined) sourceVersion = 0;
  else if (value.version === 1) sourceVersion = 1;
  else {
    sourceVersion = null;
    errors.push("version: unsupported file version");
  }

  if (!Array.isArray(value.nodes)) errors.push("nodes: expected an array");
  if (!Array.isArray(value.edges)) errors.push("edges: expected an array");
  if (errors.length > 0 || sourceVersion === null) {
    return {
      ok: false,
      file: fallback,
      diagram: diagramOf(fallback),
      warnings,
      warningDetails: detailsOf(warnings),
      errors,
      sourceVersion,
      migrated: false,
      idMap,
    };
  }

  if (sourceVersion === 1 && value.format !== undefined && value.format !== "anatomia") {
    warnings.push('format: expected "anatomia"; normalized');
  }
  if (sourceVersion === 0) warnings.push("version: migrated legacy v0 document to v1");

  const rawNodes = value.nodes as unknown[];
  const rawEdges = value.edges as unknown[];
  const nodeLimit = options.intoExisting
    ? remainingDiagramCapacity(options.intoExisting, "nodes")
    : FORMAT_LIMITS.nodes;
  const edgeLimit = options.intoExisting
    ? remainingDiagramCapacity(options.intoExisting, "edges")
    : FORMAT_LIMITS.edges;
  if (rawNodes.length > nodeLimit) {
    warnings.push(`nodes: limited to the first ${nodeLimit} items`);
  }
  if (rawEdges.length > edgeLimit) {
    warnings.push(`edges: limited to the first ${edgeLimit} items`);
  }

  const nodes: DiagNode[] = [];
  const sourceNodeIds = new Set<string>();
  const normalizedNodeCount = normalizeDiagramCount(
    "nodes",
    Math.min(rawNodes.length, nodeLimit),
  );
  for (let index = 0; index < normalizedNodeCount; index += 1) {
    const node = normalizeNode(rawNodes[index], index, warnings);
    if (!node) continue;
    if (sourceNodeIds.has(node.id)) {
      warnings.push(`nodes[${index}].id: duplicate "${node.id}"; node discarded`);
      continue;
    }
    sourceNodeIds.add(node.id);
    nodes.push(node);
  }

  const edges: DiagEdge[] = [];
  const sourceEdgeIds = new Set<string>();
  const normalizedEdgeCount = normalizeDiagramCount(
    "edges",
    Math.min(rawEdges.length, edgeLimit),
  );
  for (let index = 0; index < normalizedEdgeCount; index += 1) {
    const edge = normalizeEdge(rawEdges[index], index, warnings);
    if (!edge) continue;
    if (sourceEdgeIds.has(edge.id)) {
      warnings.push(`edges[${index}].id: duplicate "${edge.id}"; edge discarded`);
      continue;
    }
    if (!sourceNodeIds.has(edge.from) || !sourceNodeIds.has(edge.to)) {
      warnings.push(`edges[${index}]: dangling endpoint; edge discarded`);
      continue;
    }
    sourceEdgeIds.add(edge.id);
    edges.push(edge);
  }

  const shouldRemap = options.remapIds === true || options.intoExisting !== undefined;
  if (shouldRemap) {
    const used = new Set<string>();
    for (const node of options.intoExisting?.nodes ?? []) used.add(node.id);
    for (const edge of options.intoExisting?.edges ?? []) used.add(edge.id);
    for (const node of nodes) used.add(node.id);
    for (const edge of edges) used.add(edge.id);

    for (const node of nodes) {
      const sourceId = node.id;
      const nextId = uniqueId("node", sourceId, used, options.createId);
      used.add(nextId);
      idMap.set(sourceId, nextId);
      node.id = nextId;
    }
    for (const edge of edges) {
      const sourceId = edge.id;
      const nextId = uniqueId("edge", sourceId, used, options.createId);
      used.add(nextId);
      idMap.set(`edge:${sourceId}`, nextId);
      edge.id = nextId;
      edge.from = idMap.get(edge.from) ?? edge.from;
      edge.to = idMap.get(edge.to) ?? edge.to;
    }
  } else {
    for (const node of nodes) idMap.set(node.id, node.id);
    for (const edge of edges) idMap.set(`edge:${edge.id}`, edge.id);
  }

  const file: DiagramFile = {
    format: "anatomia",
    version: 1,
    meta: sourceVersion === 1 ? readMeta(value.meta, warnings) : readMeta(undefined, warnings),
    nodes,
    edges,
  };
  return {
    ok: true,
    file,
    diagram: { nodes, edges },
    warnings,
    warningDetails: detailsOf(warnings),
    errors,
    sourceVersion,
    migrated: sourceVersion === 0,
    idMap,
  };
}

/**
 * Normalize a template and append it to a diagram without ever reusing one of
 * the template's IDs. The target is left untouched when normalization fails.
 */
export function insertIntoDiagram(
  target: Diagram,
  input: unknown,
  createId: NonNullable<NormalizeOptions["createId"]>,
): InsertDiagramResult {
  const normalized = normalize(input, { intoExisting: target, createId });
  const inserted = normalized.diagram;
  if (!normalized.ok) return { ...normalized, inserted };

  const diagram: Diagram = {
    nodes: [...target.nodes, ...inserted.nodes],
    edges: [...target.edges, ...inserted.edges],
  };
  return {
    ...normalized,
    file: { ...normalized.file, nodes: diagram.nodes, edges: diagram.edges },
    diagram,
    inserted,
  };
}
