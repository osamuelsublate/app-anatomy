import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALIASES, CATALOG_VERSION } from "../src/catalog.js";
import {
  FORMAT_LIMITS,
  hasDiagramCapacity,
  insertIntoDiagram,
  isSafeDiagramId,
  normalize,
  normalizeDiagramCoordinate,
  normalizeDiagramCount,
  normalizeDiagramLabel,
  normalizeDiagramTitle,
  readDiagramFile,
  remainingDiagramCapacity,
  requireSafeDiagramId,
} from "../src/format.js";

async function fixture(path: string): Promise<unknown> {
  const contents = await readFile(new URL(`../../tests/fixtures/${path}`, import.meta.url), "utf8");
  return JSON.parse(contents) as unknown;
}

test("migrates the representative v0 fixture into the v1 envelope", async () => {
  const legacy = await fixture("legacy/v0-representative.json");
  const result = normalize(legacy);

  assert.equal(result.ok, true);
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.migrated, true);
  assert.equal(result.file.format, "anatomia");
  assert.equal(result.file.version, 1);
  assert.equal(result.file.meta.catalogVersion, CATALOG_VERSION);
  assert.deepEqual(result.diagram.nodes, (legacy as { nodes: unknown[] }).nodes);
  assert.deepEqual(result.diagram.edges, (legacy as { edges: unknown[] }).edges);
  assert.ok(result.warnings.some((warning) => warning.includes("migrated")));
  assert.deepEqual(result.errors, []);
});

test("normalizes a v1 JSON string and preserves compatible metadata", async () => {
  const diagram = await fixture("golden/diagram-input.json");
  const input = {
    format: "anatomia",
    version: 1,
    meta: {
      title: "Aula de integração",
      savedAt: "2026-08-21T12:00:00.000Z",
      catalogVersion: "baseline",
    },
    ...(diagram as object),
  };
  const result = normalize(JSON.stringify(input));

  assert.equal(result.ok, true);
  assert.equal(result.sourceVersion, 1);
  assert.equal(result.migrated, false);
  assert.deepEqual(result.file.meta, input.meta);
  assert.equal(result.file.nodes[2]?.def, "legado-customizado");
  assert.equal(result.file.nodes[0]?.x, -40.5);
  assert.equal(result.file.nodes[0]?.y, 72.25);
});

test("reads an imported file through normalize and reports read failures safely", async () => {
  const imported = await readDiagramFile({
    name: "aula.json",
    text: async () => JSON.stringify({ nodes: [], edges: [] }),
  });
  assert.equal(imported.ok, true);
  assert.equal(imported.file.meta.title, "aula");

  const failed = await readDiagramFile({
    name: "indisponivel.json",
    text: async () => {
      throw new Error("read failed");
    },
  });
  assert.equal(failed.ok, false);
  assert.match(failed.message ?? "", /diagrama atual foi preservado/);
});

test("salvages valid items while rejecting unsafe, duplicate, and dangling data", () => {
  const result = normalize({
    nodes: [
      { id: "safe", def: "api", x: 10, y: 20, label: "kept <as data>" },
      { id: "safe", def: "sql", x: 30, y: 40, label: "duplicate" },
      { id: "bad-id\"><script", def: "api", x: 0, y: 0, label: "unsafe id" },
      { id: "nan", def: "api", x: Number.NaN, y: 0, label: "not finite" },
      {
        id: "far-away",
        def: "api",
        x: FORMAT_LIMITS.coordinateMagnitude + 1,
        y: 0,
        label: "out of bounds",
      },
      { id: "unknown", def: "custom_block", x: -2.5, y: 3.75, label: "preserved" },
    ],
    edges: [
      { id: "kept-edge", from: "safe", to: "unknown", label: "kept" },
      { id: "dangling", from: "safe", to: "missing", label: "discarded" },
      { id: "bad edge", from: "safe", to: "unknown", label: "unsafe" },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.diagram.nodes.map((node) => node.id),
    ["safe", "unknown"],
  );
  assert.deepEqual(
    result.diagram.edges.map((edge) => edge.id),
    ["kept-edge"],
  );
  assert.equal(result.diagram.nodes[0]?.label, "kept <as data>");
  assert.equal(result.diagram.nodes[1]?.def, "custom_block");
  assert.ok(result.warnings.length >= 5);
});

test("edge anchors, line style and waypoints are validated on ingestion", () => {
  const result = normalize({
    nodes: [
      { id: "a", def: "api", x: 0, y: 0, label: "A" },
      { id: "b", def: "sql", x: 200, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "full",
        from: "a",
        to: "b",
        label: "ok",
        fromSide: "right",
        toSide: "left",
        line: "ortho",
        points: [{ x: 100, y: 50 }, { x: 120, y: -30.5 }],
      },
      { id: "loop", from: "a", to: "a", label: "", fromSide: "top", toSide: "bottom" },
      {
        id: "bad-extras",
        from: "a",
        to: "b",
        label: "",
        fromSide: "diagonal",
        line: "zigzag",
        points: [{ x: Number.NaN, y: 0 }, { x: 1, y: 2 }, "junk"],
      },
      { id: "bad-points", from: "b", to: "a", label: "", points: "nope" },
    ],
  });

  assert.equal(result.ok, true);
  const [full, loop, badExtras, badPoints] = result.diagram.edges;
  assert.equal(full?.fromSide, "right");
  assert.equal(full?.toSide, "left");
  assert.equal(full?.line, "ortho");
  assert.deepEqual(full?.points, [{ x: 100, y: 50 }, { x: 120, y: -30.5 }]);
  // Auto-loop sobrevive à checagem de arestas penduradas.
  assert.equal(loop?.from, "a");
  assert.equal(loop?.to, "a");
  // Valores inválidos são descartados campo a campo, sem derrubar a aresta.
  assert.equal(badExtras?.fromSide, undefined);
  assert.equal(badExtras?.line, undefined);
  assert.deepEqual(badExtras?.points, [{ x: 1, y: 2 }]);
  assert.equal(badPoints?.points, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes("fromSide")));
  assert.ok(result.warnings.some((warning) => warning.includes("line")));
  assert.ok(result.warnings.some((warning) => warning.includes("points")));
});

test("edge waypoints are capped at the format limit", () => {
  const result = normalize({
    nodes: [
      { id: "a", def: "api", x: 0, y: 0, label: "A" },
      { id: "b", def: "sql", x: 200, y: 0, label: "B" },
    ],
    edges: [{
      id: "many",
      from: "a",
      to: "b",
      label: "",
      points: Array.from({ length: FORMAT_LIMITS.edgePoints + 5 }, (_, index) => ({ x: index, y: index })),
    }],
  });
  assert.equal(result.diagram.edges[0]?.points?.length, FORMAT_LIMITS.edgePoints);
  assert.ok(result.warnings.some((warning) => warning.includes("points")));
});

test("translates every catalog alias without rewriting unknown definitions", () => {
  const nodes = [
    ...Object.keys(ALIASES).map((def, index) => ({
      id: `alias-${index}`,
      def,
      x: index,
      y: index,
      label: def,
    })),
    { id: "unknown", def: "future-service", x: 0, y: 0, label: "future" },
  ];
  const result = normalize({ nodes, edges: [] });

  assert.equal(result.ok, true);
  for (const [index, target] of Object.values(ALIASES).entries()) {
    assert.equal(result.diagram.nodes[index]?.def, target);
  }
  assert.equal(result.diagram.nodes.at(-1)?.def, "future-service");
});

test("enforces collection and text limits deterministically", () => {
  const nodes = Array.from({ length: FORMAT_LIMITS.nodes + 2 }, (_, index) => ({
    id: `node-${index}`,
    def: "api",
    x: index,
    y: 0,
    label: "x".repeat(FORMAT_LIMITS.labelCharacters + 10),
  }));
  const first = normalize({ nodes, edges: [] });
  const second = normalize({ nodes, edges: [] });

  assert.equal(first.diagram.nodes.length, FORMAT_LIMITS.nodes);
  assert.equal(first.diagram.nodes[0]?.label.length, FORMAT_LIMITS.labelCharacters);
  assert.deepEqual(first.file, second.file);
  assert.deepEqual(first.warnings, second.warnings);
});

test("mutation-boundary helper outputs round-trip through v1 unchanged", () => {
  const title = normalizeDiagramTitle("t".repeat(FORMAT_LIMITS.titleCharacters + 20));
  const label = normalizeDiagramLabel("l".repeat(FORMAT_LIMITS.labelCharacters + 20));
  const x = normalizeDiagramCoordinate(Number.POSITIVE_INFINITY);
  const y = normalizeDiagramCoordinate(FORMAT_LIMITS.coordinateMagnitude + 20);
  const nodeId = requireSafeDiagramId("node_safe-1");
  const edgeId = requireSafeDiagramId("edge_safe-1");
  const nodeCount = normalizeDiagramCount("nodes", FORMAT_LIMITS.nodes + 20);
  const edgeCount = normalizeDiagramCount("edges", -20);
  const file = {
    format: "anatomia",
    version: 1,
    meta: { title, catalogVersion: CATALOG_VERSION },
    nodes: [{ id: nodeId, def: "future-service", x, y, label }],
    edges: [{ id: edgeId, from: nodeId, to: nodeId, label }],
  };

  const result = normalize(file);

  assert.equal(result.ok, true);
  assert.deepEqual(result.file, file);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.warningDetails, []);
  assert.equal(nodeCount, FORMAT_LIMITS.nodes);
  assert.equal(edgeCount, 0);
  assert.equal(isSafeDiagramId(nodeId), true);
  assert.equal(isSafeDiagramId("unsafe id"), false);
  let rejectedUnsafeId = false;
  try {
    requireSafeDiagramId("unsafe id");
  } catch (error) {
    rejectedUnsafeId = error instanceof RangeError;
  }
  assert.equal(rejectedUnsafeId, true);
});

test("capacity helpers and insertion prevent nodes or edges being dropped on round-trip", () => {
  const target = {
    nodes: Array.from({ length: FORMAT_LIMITS.nodes - 1 }, (_, index) => ({
      id: `existing-${index}`,
      def: "unknown-preserved",
      x: 0,
      y: 0,
      label: "",
    })),
    edges: [],
  };
  const fragment = {
    nodes: [
      { id: "first", def: "first-unknown", x: 0, y: 0, label: "" },
      { id: "second", def: "second-unknown", x: 0, y: 0, label: "" },
    ],
    edges: [{ id: "between", from: "first", to: "second", label: "" }],
  };

  assert.equal(remainingDiagramCapacity(target, "nodes"), 1);
  assert.equal(hasDiagramCapacity(target, "nodes"), true);
  assert.equal(hasDiagramCapacity(target, "nodes", 2), false);

  let sequence = 0;
  const inserted = insertIntoDiagram(
    target,
    fragment,
    (kind) => `${kind}-capacity-${++sequence}`,
  );
  const roundTrip = normalize(inserted.file);

  assert.equal(inserted.ok, true);
  assert.equal(inserted.diagram.nodes.length, FORMAT_LIMITS.nodes);
  assert.equal(inserted.inserted.nodes[0]?.def, "first-unknown");
  assert.deepEqual(inserted.inserted.edges, []);
  assert.deepEqual(roundTrip.file, inserted.file);
  assert.equal(roundTrip.warnings.length, 0);
});

test("remaps inserted IDs and keeps edge endpoints consistent", async () => {
  const legacy = await fixture("legacy/v0-representative.json");
  let sequence = 0;
  const result = normalize(legacy, {
    intoExisting: {
      nodes: [{ id: "legacy-user", def: "usuario", x: 0, y: 0, label: "existing" }],
      edges: [],
    },
    createId: (kind) => `${kind}-imported-${++sequence}`,
  });

  assert.equal(result.ok, true);
  const nodeIds = new Set(result.diagram.nodes.map((node) => node.id));
  assert.ok(!nodeIds.has("legacy-user"));
  assert.equal(nodeIds.size, result.diagram.nodes.length);
  for (const edge of result.diagram.edges) {
    assert.ok(nodeIds.has(edge.from));
    assert.ok(nodeIds.has(edge.to));
  }
  assert.equal(result.idMap.get("legacy-user"), "node-imported-1");
});

test("returns explicit errors for malformed or unsupported top-level input", () => {
  for (const input of [
    "{not-json",
    null,
    [],
    { format: "anatomia", version: 99, nodes: [], edges: [] },
    { nodes: "wrong", edges: [] },
  ]) {
    const result = normalize(input);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.diagram, { nodes: [], edges: [] });
  }
});

test("normalization exposes structured warning details without breaking string warnings", () => {
  const result = normalize({
    format: "anatomia",
    version: 1,
    meta: { title: "", catalogVersion: CATALOG_VERSION },
    nodes: [
      {
        id: "kept",
        def: "unknown",
        x: 0,
        y: 0,
        label: "x".repeat(FORMAT_LIMITS.labelCharacters + 1),
      },
      { id: "unsafe id", def: "unknown", x: 0, y: 0, label: "" },
    ],
    edges: [],
  });

  assert.equal(result.warningDetails.length, result.warnings.length);
  assert.deepEqual(
    result.warningDetails.map(({ code, path }) => ({ code, path })),
    [
      { code: "truncated", path: "nodes[0].label" },
      { code: "discarded", path: "nodes[1].id" },
    ],
  );
});
