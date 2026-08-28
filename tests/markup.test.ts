import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildExportSvg, documentMarkup, interactionMarkup, isBackdropNode, overlayMarkup, paletteMarkup, presentationDiagram, type MarkupVisualState } from "../src/markup.js";
import type { Diagram } from "../src/types.js";

async function goldenText(name: string): Promise<string> {
  return readFile(new URL(`../../tests/fixtures/golden/${name}`, import.meta.url), "utf8");
}

async function goldenDiagram(): Promise<Diagram> {
  return JSON.parse(await goldenText("diagram-input.json")) as Diagram;
}

test("export markup matches the intentional local-coordinate golden hash and geometry", async () => {
  const diagram = await goldenDiagram();
  const output = buildExportSvg(diagram);
  const expectedHash = (await goldenText("diagram-export.sha256")).trim();

  assert.ok(output);
  assert.equal(output.svg, buildExportSvg(structuredClone(diagram))?.svg);
  assert.equal(createHash("sha256").update(output.svg).digest("hex"), expectedHash);
  assert.match(output.svg, /viewBox="-88.5 -8 807 340"/);
  assert.match(output.svg, /transform="translate\(-40.5 72.25\)"/);
  assert.match(output.svg, /transform="translate\(250 180\)"/);
  assert.deepEqual({ w: output.w, h: output.h }, { w: 807, h: 340 });
});

test("golden rendering preserves unknown definitions, labels, and safe IDs", async () => {
  const diagram = await goldenDiagram();
  const markup = documentMarkup(diagram);

  assert.match(markup, /data-node-id="golden-user"/);
  assert.match(markup, /data-edge-id="golden-edge-request"/);
  assert.match(markup, /fill="#F6F4EE"/);
  // def desconhecido cai no glifo de interrogação do set autoral (inline, sem <use>)
  assert.match(markup, /a2\.5 2\.5 0 1 1 3\.4 2\.3/);
  assert.ok(!markup.includes("twemoji"));
  assert.ok(!/<text[^>]*>[^<]*❓<\/text>/.test(markup));
  assert.match(markup, /Usuário &amp; turma/);
  assert.match(markup, /API &quot;principal&quot;/);
  assert.match(markup, /Sistema &lt;legado&gt;/);
  assert.match(markup, /envia &lt;pedido&gt;/);
});

test("export embeds inline professional glyphs with no symbols, emoji, or external references", () => {
  const diagram: Diagram = {
    nodes: [
      { id: "dev", def: "dev", x: 0, y: 0, label: "Dev" },
      { id: "k8s", def: "k8s", x: 240, y: 0, label: "Kubernetes" },
    ],
    edges: [],
  };
  const svg = buildExportSvg(diagram)?.svg ?? "";

  // um grupo de glifo por nó, desenhado inline em paths (sem <symbol>/<use>)
  assert.equal((svg.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((svg.match(/<symbol /g) ?? []).length, 0);
  assert.ok(!svg.includes("twemoji"));
  assert.match(svg, /m15\.5 12\.5-3 3 3 3/); // chevrons de código do glifo "dev"
  assert.match(svg, /M6\.3 6\.3l2\.6 2\.6/); // raios do leme genérico do glifo "k8s"
  assert.ok(!/<text[^>]*>[^<]*[\u{1F300}-\u{1FAFF}]/u.test(svg));
  assert.ok(!/\b(?:href|src)="https?:/i.test(svg));
});

test("presentation reveal follows node order and hides incomplete edges without mutating input", () => {
  const diagram: Diagram = {
    nodes: [
      { id: "one", def: "api", x: 0, y: 0, label: "One" },
      { id: "two", def: "sql", x: 240, y: 0, label: "Two" },
      { id: "three", def: "email", x: 480, y: 0, label: "Three" },
    ],
    edges: [
      { id: "one-two", from: "one", to: "two", label: "" },
      { id: "two-three", from: "two", to: "three", label: "" },
    ],
  };
  const before = structuredClone(diagram);

  assert.deepEqual(presentationDiagram(diagram, 1), { nodes: [diagram.nodes[0]], edges: [] });
  assert.deepEqual(
    presentationDiagram(diagram, 2).edges.map(({ id }) => id),
    ["one-two"],
  );
  assert.deepEqual(presentationDiagram(diagram, 99), diagram);
  assert.deepEqual(diagram, before);
});

test("laser belongs only to overlay and never to document or export", () => {
  const diagram: Diagram = {
    nodes: [{ id: "one", def: "api", x: 0, y: 0, label: "One" }],
    edges: [],
  };
  const state: MarkupVisualState = {
    selection: null,
    connectFrom: null,
    connectCursor: null,
    presentation: true,
    laser: { x: 80, y: 52 },
  };

  assert.match(overlayMarkup(diagram, state), /class="laser-pointer"/);
  assert.equal(interactionMarkup(diagram, state), "");
  assert.ok(!documentMarkup(diagram).includes("laser-pointer"));
  assert.ok(!buildExportSvg(diagram)?.svg.includes("laser-pointer"));
});

test("overlay state cannot change document markup or exported SVG", () => {
  const diagram: Diagram = {
    nodes: [
      { id: "source", def: "api", x: 0, y: 0, label: "Source" },
      { id: "target", def: "sql", x: 240, y: 0, label: "Target" },
    ],
    edges: [{ id: "edge", from: "source", to: "target", label: "calls" }],
  };
  const visualState: MarkupVisualState = {
    selection: { kind: "edge", id: "edge" },
    connectFrom: "source",
    connectCursor: { x: 190, y: 150 },
  };
  const document = documentMarkup(diagram);
  const exported = buildExportSvg(diagram);
  const overlay = overlayMarkup(diagram, visualState);

  assert.equal(documentMarkup(diagram), document);
  assert.equal(buildExportSvg(diagram)?.svg, exported?.svg);
  assert.ok(!document.includes("selection-outline"));
  assert.ok(!document.includes("connection-source"));
  assert.ok(!exported?.svg.includes("selection-outline"));
  assert.ok(!exported?.svg.includes("connection-source"));
  assert.match(overlay, /stroke="#6965DB"/);
  assert.match(overlay, /L 190 150/);
  assert.match(overlay, /class="connection-source"/);
});

test("dynamic IDs and labels cannot break out of SVG attributes or text", () => {
  const unsafeId = `node" onload="alert(1)`;
  const diagram: Diagram = {
    nodes: [
      {
        id: unsafeId,
        def: "future",
        x: 0,
        y: 0,
        label: `<script>alert("node")</script> & 'quoted'`,
      },
      { id: "safe", def: "api", x: 240, y: 0, label: "Safe" },
    ],
    edges: [
      {
        id: `edge"><script>alert(2)</script>`,
        from: unsafeId,
        to: "safe",
        label: `<image href="bad">`,
      },
    ],
  };
  const markup = documentMarkup(diagram);

  assert.match(markup, /data-node-id="node&quot; onload=&quot;alert\(1\)"/);
  assert.match(markup, /data-edge-id="edge&quot;&gt;&lt;script&gt;alert\(2\)&lt;\/script&gt;"/);
  assert.ok(!markup.includes("<script>"));
  assert.ok(!markup.includes("<image"));
  assert.match(markup, /&lt;script&gt;alert\(&quot;node&quot;\)&lt;\/script&gt;/);
  assert.match(markup, /&amp; &#39;quoted&#39;/);
  assert.match(markup, /&lt;image href=&quot;bad&quot;&gt;/);
});

test("oversized nodes paint behind edges so a server can wrap its services", () => {
  const server = { id: "box", def: "servidor", x: 0, y: 0, w: 400, h: 280, label: "Servidor" };
  const inner = { id: "inner", def: "api", x: 80, y: 80, label: "API" };
  const outside = { id: "nav", def: "navegador", x: 80, y: -160, label: "Navegador" };
  assert.equal(isBackdropNode(server), true);
  assert.equal(isBackdropNode(inner), false);

  const markup = documentMarkup({
    nodes: [inner, server, outside],
    edges: [{ id: "carrega", from: "nav", to: "inner", label: "carrega" }],
  });
  const boxAt = markup.indexOf('data-node-id="box"');
  const edgeAt = markup.indexOf('data-edge-id="carrega"');
  const innerAt = markup.indexOf('data-node-id="inner"');

  assert.ok(boxAt >= 0 && edgeAt > boxAt && innerAt > edgeAt);
});

test("dangling edges are omitted and empty diagrams do not export", () => {
  const diagram: Diagram = {
    nodes: [{ id: "safe", def: "api", x: 0, y: 0, label: "Safe" }],
    edges: [{ id: "dangling", from: "safe", to: "missing", label: "ignored" }],
  };

  assert.ok(!documentMarkup(diagram).includes("dangling"));
  assert.equal(buildExportSvg({ nodes: [], edges: [] }), null);
});

test("interaction layer owns ports and guides while export excludes them", () => {
  const diagram: Diagram = {
    nodes: [{ id: "safe", def: "api", x: 24, y: 48, label: "Safe" }],
    edges: [],
  };
  const state: MarkupVisualState = {
    selection: { kind: "node", id: "safe" },
    connectFrom: null,
    connectCursor: null,
    guides: [{ axis: "x", position: 24, from: 0, to: 300 }],
  };
  const interaction = interactionMarkup(diagram, state);
  const exported = buildExportSvg(diagram)?.svg ?? "";

  assert.equal((interaction.match(/class="port"/g) ?? []).length, 4);
  assert.match(interaction, /tabindex="0"/);
  assert.match(interaction, /alignment-guide/);
  assert.ok(!exported.includes('class="port"'));
  assert.ok(!exported.includes("alignment-guide"));
  assert.ok(!exported.includes("selection-outline"));

  // canvas vazio fica vazio de verdade — nenhum cartão, título ou dica
  const empty = interactionMarkup({ nodes: [], edges: [] }, { ...state, selection: null });
  assert.equal(empty, "");
});

test("palette opens essentials only and escapes searchable content", () => {
  const markup = paletteMarkup("");
  assert.match(markup, /<details open data-cat="essenciais">/);
  assert.equal((markup.match(/<details open/g) ?? []).length, 1);
  assert.equal((markup.match(/data-def=/g) ?? []).length, 73);
  const filtered = paletteMarkup("banco");
  assert.ok(!filtered.includes('data-cat="pessoas"'));
  assert.match(filtered, /data-cat="dados"/);
});
