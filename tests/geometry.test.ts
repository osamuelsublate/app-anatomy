import assert from "node:assert/strict";
import test from "node:test";

import { alignmentGuides, anchorOnRect, diagramBounds, snapPoint, wrapLabel } from "../src/geometry.js";
import type { Diagram, DiagNode } from "../src/types.js";

function node(x: number, y: number, id = "node"): DiagNode {
  return { id, def: "api", x, y, label: id };
}

function closeTo(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `expected ${actual} to be close to ${expected}`);
}

test("anchorOnRect returns the center for a coincident target", () => {
  assert.deepEqual(anchorOnRect(node(-75, -52), 0, 0), { x: 0, y: 0 });
});

test("anchorOnRect reaches each side and preserves the six-unit gap", () => {
  const centered = node(-75, -52);

  assert.deepEqual(anchorOnRect(centered, 100, 0), { x: 81, y: 0 });
  assert.deepEqual(anchorOnRect(centered, -100, 0), { x: -81, y: 0 });
  closeTo(anchorOnRect(centered, 0, 100).y, 58);
  closeTo(anchorOnRect(centered, 0, -100).y, -58);
});

test("anchorOnRect handles diagonal, nearby, negative, and fractional geometry", () => {
  const diagonal = anchorOnRect(node(-75, -52), 100, 100);
  closeTo(diagonal.x, 56.242640687119284);
  closeTo(diagonal.y, 56.242640687119284);

  assert.deepEqual(anchorOnRect(node(-75, -52), 1, 0), { x: 75.2, y: 0 });

  const fractional = anchorOnRect(node(-10.5, -20.25), -100.25, 31.75);
  assert.deepEqual(fractional, { x: -16.5, y: 31.75 });
});

test("wrapLabel normalizes whitespace and respects the default limit", () => {
  assert.deepEqual(wrapLabel("  alpha \n beta\tgamma  "), ["alpha beta gamma"]);
  assert.deepEqual(wrapLabel("12345678901234567 next"), ["12345678901234567", "next"]);
  assert.deepEqual(wrapLabel(""), []);
  assert.deepEqual(wrapLabel(" \n\t "), []);
});

test("wrapLabel preserves oversized words and truncates only after two lines", () => {
  assert.deepEqual(wrapLabel("supercalifragilisticexpialidocious"), [
    "supercalifragilisticexpialidocious",
  ]);
  assert.deepEqual(wrapLabel("one two three four five", 7), ["one two", "three…"]);
  assert.deepEqual(wrapLabel("one two three", 7), ["one two", "three"]);
});

test("diagramBounds returns null for diagrams without finite nodes", () => {
  assert.equal(diagramBounds({ nodes: [], edges: [] }, 60), null);
  assert.equal(
    diagramBounds(
      {
        nodes: [node(Number.NaN, 1), node(1, Number.POSITIVE_INFINITY)],
        edges: [],
      },
      60,
    ),
    null,
  );
});

test("diagramBounds includes node dimensions with fractional coordinates and margin", () => {
  assert.deepEqual(diagramBounds({ nodes: [node(-10.5, 20.25)], edges: [] }, 2.5), {
    minX: -13,
    minY: 17.75,
    maxX: 142,
    maxY: 126.75,
    width: 155,
    height: 109,
  });
});

test("diagramBounds finds negative and positive extremes in one pass", () => {
  const diagram: Diagram = {
    nodes: [node(-200, -50, "left"), node(10.5, -300.25, "top")],
    edges: [],
  };

  assert.deepEqual(diagramBounds(diagram, 10), {
    minX: -210,
    minY: -310.25,
    maxX: 170.5,
    maxY: 64,
    width: 380.5,
    height: 374.25,
  });
});

test("diagramBounds ignores non-finite nodes when finite geometry remains", () => {
  const diagram: Diagram = {
    nodes: [node(Number.NEGATIVE_INFINITY, 0, "invalid"), node(4, -8, "valid")],
    edges: [],
  };

  assert.deepEqual(diagramBounds(diagram, 0), {
    minX: 4,
    minY: -8,
    maxX: 154,
    maxY: 96,
    width: 150,
    height: 104,
  });
});

test("diagramBounds handles collections too large for spread-based Math limits", () => {
  const nodes: DiagNode[] = [];
  for (let index = 0; index < 200_000; index += 1) {
    nodes.push(node(index - 100_000, 50_000 - index / 2, `node-${index}`));
  }

  assert.deepEqual(diagramBounds({ nodes, edges: [] }, 1), {
    minX: -100_001,
    minY: -50_000.5,
    maxX: 100_150,
    maxY: 50_105,
    width: 200_151,
    height: 100_105.5,
  });
});

test("snap uses the 24px grid unless free positioning is requested", () => {
  assert.deepEqual(snapPoint({ x: 35, y: -13 }), { x: 24, y: -24 });
  assert.deepEqual(snapPoint({ x: 35, y: -13 }, true), { x: 35, y: -13 });
});

test("alignment guides compare node edges and centers without self-guides", () => {
  const moving = node(150, 100, "moving");
  const guides = alignmentGuides(moving, [
    moving,
    node(150, 300, "same-left"),
    node(300, 100, "touching-right"),
  ]);

  assert.ok(guides.some((guide) => guide.axis === "x" && guide.position === 150));
  assert.ok(guides.some((guide) => guide.axis === "x" && guide.position === 300));
  assert.ok(guides.some((guide) => guide.axis === "y" && guide.position === 100));
});
