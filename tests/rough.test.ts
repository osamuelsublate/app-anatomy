import assert from "node:assert/strict";
import test from "node:test";

import { arrowHead, fillRectPath, roughLine, roughRectOutline } from "../src/rough.js";

test("rough paths are deterministic for the same seed and geometry", () => {
  const calls = [
    () => roughRectOutline(-40.5, 72.25, 150, 104, "golden-user"),
    () => roughLine(10.25, -5, 240, 180.5, "golden-edge"),
    () => arrowHead(10.25, -5, 240, 180.5, "golden-edge"),
  ];

  for (const render of calls) {
    assert.equal(render(), render());
  }
});

test("rough paths vary when their seed changes", () => {
  assert.notEqual(
    roughRectOutline(10, 20, 150, 104, "node-a"),
    roughRectOutline(10, 20, 150, 104, "node-b"),
  );
  assert.notEqual(roughLine(0, 0, 100, 50, "edge-a"), roughLine(0, 0, 100, 50, "edge-b"));
  assert.notEqual(arrowHead(0, 0, 100, 50, "edge-a"), arrowHead(0, 0, 100, 50, "edge-b"));
});

test("rough output contains only finite SVG path coordinates", () => {
  const output = [
    roughRectOutline(-40.5, 72.25, 150, 104, "golden-user"),
    roughLine(-100, 50, 0, 50, "zero-safe"),
    arrowHead(0, 0, 0, 0, "degenerate"),
  ].join(" ");

  assert.ok(!output.includes("NaN"));
  assert.ok(!output.includes("Infinity"));
});

test("fill path is stable and closes the rounded rectangle", () => {
  assert.equal(
    fillRectPath(-40.5, 72.25, 150, 104, 10),
    "M -30.5 72.25 H 99.5 Q 109.5 72.25 109.5 82.25 V 166.25 Q 109.5 176.25 99.5 176.25 H -30.5 Q -40.5 176.25 -40.5 166.25 V 82.25 Q -40.5 72.25 -30.5 72.25 Z",
  );
});
