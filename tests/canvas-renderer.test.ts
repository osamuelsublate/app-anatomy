import assert from "node:assert/strict";
import test from "node:test";

import { createCanvasRenderer, type CanvasLayer } from "../src/canvas-renderer.js";
import type { Diagram } from "../src/types.js";

class FakeElement {
  readonly attributes = new Map<string, string>();
  outerHTML = "";
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
}

class FakeLayer implements CanvasLayer {
  writes = 0;
  value = "";
  readonly elements = new Map<string, FakeElement>();
  get innerHTML(): string { return this.value; }
  set innerHTML(value: string) { this.writes += 1; this.value = value; }
  querySelector(selector: string): Element | null {
    return (this.elements.get(selector) ?? null) as unknown as Element | null;
  }
}

test("drag patch changes transforms and incident edges without innerHTML writes", () => {
  const documentLayer = new FakeLayer();
  const interactionLayer = new FakeLayer();
  const overlayLayer = new FakeLayer();
  const node = new FakeElement();
  const ports = new FakeElement();
  const edge = new FakeElement();
  const guides = new FakeElement();
  documentLayer.elements.set('[data-node-id="source"]', node);
  documentLayer.elements.set('[data-edge-id="edge"]', edge);
  interactionLayer.elements.set('[data-ports-for="source"]', ports);
  interactionLayer.elements.set(".alignment-guides", guides);
  const renderer = createCanvasRenderer(documentLayer, interactionLayer, overlayLayer);
  const diagram: Diagram = {
    nodes: [
      { id: "source", def: "api", x: 48, y: 72, label: "Source" },
      { id: "target", def: "sql", x: 300, y: 72, label: "Target" },
    ],
    edges: [{ id: "edge", from: "source", to: "target", label: "" }],
  };

  renderer.patchDrag(diagram, {
    selection: { kind: "node", id: "source" },
    connectFrom: null,
    connectCursor: null,
    guides: [{ axis: "y", position: 124, from: 24, to: 500 }],
  }, "source");

  assert.deepEqual(
    { document: documentLayer.writes, interaction: interactionLayer.writes, overlay: overlayLayer.writes },
    { document: 0, interaction: 0, overlay: 0 },
  );
  assert.equal(node.attributes.get("transform"), "translate(48 72)");
  assert.equal(ports.attributes.get("transform"), "translate(48 72)");
  assert.match(edge.outerHTML, /data-edge-id="edge"/);
  assert.match(guides.outerHTML, /alignment-guide/);
  assert.equal(documentLayer.elements.get('[data-node-id="source"]'), node, "focused node identity is stable");
});
