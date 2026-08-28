import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CATALOG_VERSION, resolveDef } from "../src/catalog.js";
import { insertIntoDiagram, normalize } from "../src/format.js";
import { isBackdropNode } from "../src/markup.js";
import { DIAGRAM_TEMPLATES } from "../src/model.js";
import type { Diagram, DiagramFile } from "../src/types.js";

const TEMPLATE_FILES = [
  "aula-1-viagem-pagina.json",
  "aula-2-organizacao.json",
  "aula-3-dados-regras-login.json",
  "aula-4-mundo-real.json",
  "anatomia-completa.json",
  "caminho-de-um-clique.json",
  "comecar-do-zero.json",
  "login-seguro.json",
] as const;

const LESSONS = [
  { file: "aula-1-viagem-pagina.json", id: "aula-1-viagem-pagina", title: "Aula 1 — Fluxo básico", num: "1" },
  { file: "aula-2-organizacao.json", id: "aula-2-organizacao", title: "Aula 2 — Monólito e pedaços", num: "2" },
  { file: "aula-3-dados-regras-login.json", id: "aula-3-dados-regras-login", title: "Aula 3 — Integrações", num: "3" },
  { file: "aula-4-mundo-real.json", id: "aula-4-mundo-real", title: "Aula 4 — Servidores", num: "4" },
] as const;

async function loadTemplate(name: (typeof TEMPLATE_FILES)[number]): Promise<unknown> {
  const contents = await readFile(
    new URL(`../../public/templates/${name}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(contents) as unknown;
}

test("lesson templates are valid v1 files with known catalog definitions", async () => {
  for (const name of TEMPLATE_FILES) {
    const result = normalize(await loadTemplate(name));

    assert.equal(result.ok, true, `${name} should normalize`);
    assert.equal(result.sourceVersion, 1);
    assert.equal(result.file.format, "anatomia");
    assert.equal(result.file.version, 1);
    assert.equal(result.file.meta.catalogVersion, CATALOG_VERSION);
    assert.ok(result.file.meta.title.length > 0);
    if (name === "comecar-do-zero.json") {
      assert.deepEqual(result.file.nodes, []);
      assert.deepEqual(result.file.edges, []);
    } else {
      assert.ok(result.file.nodes.length > 0);
      assert.ok(result.file.edges.length > 0);
    }
    for (const node of result.file.nodes) {
      assert.ok(resolveDef(node.def), `${name} uses unknown definition ${node.def}`);
    }
  }
});

test("lesson templates survive a normalized JSON load round-trip", async () => {
  for (const name of TEMPLATE_FILES) {
    const loaded = normalize(await loadTemplate(name));
    const roundTrip = normalize(JSON.stringify(loaded.file));

    assert.equal(roundTrip.ok, true);
    assert.deepEqual(roundTrip.file, loaded.file);
  }
});

test("course lessons follow the lovable-to-anatomy teaching arc", async () => {
  assert.deepEqual(
    DIAGRAM_TEMPLATES.slice(0, 4).map(({ id, label }) => ({ id, title: label })),
    LESSONS.map(({ id, title }) => ({ id, title })),
  );

  const expected = {
    "aula-1-viagem-pagina.json": {
      defs: ["usuario", "navegador", "monolito", "frontend", "api", "sql"],
      labels: [
        "Aula 1 — Fluxo básico",
        "O navegador não é a aplicação. O pedido passa pelo frontend, pela API e chega no banco.",
        "Como a gente pensa",
        "O que acontece",
        "Aplicação",
        "Frontend",
        "API",
        "Banco de dados",
      ],
    },
    "aula-2-organizacao.json": {
      defs: ["computador", "celular", "frontend", "api"],
      labels: [
        "Aula 2 — Monólito e pedaços",
        "O fluxo básico é um monólito. Para crescer, vários frontends usam a mesma API.",
        "Monolito",
        "Distribuída",
        "Desktop",
        "Celular",
      ],
    },
    "aula-3-dados-regras-login.json": {
      defs: ["ia", "pagamentos"],
      labels: [
        "Aula 3 — Integrações",
        "A API também chama terceiros: IA, pagamentos e o que o produto precisar.",
        "IA / LLM",
        "Pagamentos",
      ],
    },
    "aula-4-mundo-real.json": {
      defs: ["servidor"],
      labels: [
        "Aula 4 — Servidores",
        "No monólito tudo roda num servidor. Na distribuída, frontend e API ficam em servidores diferentes.",
        "Servidor",
        "Servidor frontend",
        "Servidor API",
      ],
    },
  } as const;

  for (const lesson of LESSONS) {
    const result = normalize(await loadTemplate(lesson.file));
    assert.equal(result.ok, true);
    assert.equal(result.file.meta.title, lesson.title);
    assert.ok(result.file.nodes.every((node) => node.id.startsWith(`aula${lesson.num}`)));
    const defs = result.file.nodes.map((node) => node.def);
    const labels = new Set(result.file.nodes.map((node) => node.label));
    for (const def of expected[lesson.file].defs) {
      assert.ok(defs.includes(def), `${lesson.file} should include ${def}`);
    }
    for (const label of expected[lesson.file].labels) {
      assert.ok(labels.has(label), `${lesson.file} should include ${label}`);
    }
    for (const node of result.file.nodes) {
      assert.ok(resolveDef(node.def), `${lesson.file} uses unknown definition ${node.def}`);
    }
    if (lesson.file === "aula-4-mundo-real.json") {
      const servers = result.file.nodes.filter((node) => node.def === "servidor");
      assert.equal(servers.length, 3);
      assert.ok(servers.every((node) => isBackdropNode(node)));
    }
  }
});

test("the native menu exposes all lessons before the preserved generic templates", async () => {
  const html = await readFile(new URL("../../public/index.html", import.meta.url), "utf8");
  const lessonPositions = LESSONS.map(({ id, title }) => {
    assert.match(html, new RegExp(`<option value="${id}">${title}</option>`));
    return html.indexOf(`value="${id}"`);
  });
  const firstGeneric = html.indexOf('value="anatomia-completa"');

  assert.ok(lessonPositions.every((position) => position >= 0 && position < firstGeneric));
  assert.match(html, /<optgroup label="Outros modelos">/);
});

test("the first template is the complete former seed example", async () => {
  const result = normalize(await loadTemplate("anatomia-completa.json"));

  assert.equal(result.file.meta.title, "Anatomia completa de um app");
  assert.deepEqual(
    result.diagram.nodes.map((node) => node.def),
    ["usuario", "navegador", "frontend", "api", "auth", "sql", "email"],
  );
  assert.deepEqual(
    result.diagram.edges.map((edge) => edge.label),
    ["usa", "baixa e executa", "pedidos e dados", "quem é você?", "lê e grava", "envia emails"],
  );
});

test("insertion remaps overlapping node and edge IDs and every endpoint", async () => {
  const template = await loadTemplate("anatomia-completa.json") as DiagramFile;
  const target: Diagram = {
    nodes: [
      { id: "template-user", def: "future-existing", x: 0, y: 0, label: "Existing" },
    ],
    edges: [
      {
        id: "template-edge-use",
        from: "template-user",
        to: "template-user",
        label: "Existing edge",
      },
    ],
  };
  const calls: string[] = [];
  const createId = (kind: "node" | "edge", sourceId: string, attempt: number): string => {
    calls.push(`${kind}:${sourceId}:${attempt}`);
    return attempt === 1 ? sourceId : `inserted-${kind}-${sourceId}-${attempt}`;
  };

  const result = insertIntoDiagram(target, template, createId);

  assert.equal(result.ok, true);
  assert.equal(result.diagram.nodes.length, target.nodes.length + template.nodes.length);
  assert.equal(result.diagram.edges.length, target.edges.length + template.edges.length);
  assert.deepEqual(result.diagram.nodes[0], target.nodes[0]);
  assert.deepEqual(result.diagram.edges[0], target.edges[0]);
  assert.equal(result.inserted.nodes[0]?.def, "usuario");
  assert.equal(result.idMap.get("template-user"), "inserted-node-template-user-2");
  assert.equal(
    result.idMap.get("edge:template-edge-use"),
    "inserted-edge-template-edge-use-2",
  );
  assert.ok(calls.some((call) => call === "node:template-user:1"));
  assert.ok(calls.some((call) => call === "edge:template-edge-use:1"));
  for (const node of template.nodes) {
    assert.ok(calls.some((call) => call.startsWith(`node:${node.id}:`)));
  }
  for (const edge of template.edges) {
    assert.ok(calls.some((call) => call.startsWith(`edge:${edge.id}:`)));
  }

  const allIds = [
    ...result.diagram.nodes.map((node) => node.id),
    ...result.diagram.edges.map((edge) => edge.id),
  ];
  assert.equal(new Set(allIds).size, allIds.length);
  const insertedNodeIds = new Set(result.inserted.nodes.map((node) => node.id));
  for (const edge of result.inserted.edges) {
    assert.ok(insertedNodeIds.has(edge.from));
    assert.ok(insertedNodeIds.has(edge.to));
  }
});

test("insertion is deterministic for a deterministic ID source", async () => {
  const template = await loadTemplate("caminho-de-um-clique.json");
  const target: Diagram = { nodes: [], edges: [] };
  const createId = (kind: "node" | "edge", sourceId: string, attempt: number): string =>
    `${kind}-${sourceId}-${attempt}`;

  const first = insertIntoDiagram(target, template, createId);
  const second = insertIntoDiagram(target, template, createId);

  assert.deepEqual(first.diagram, second.diagram);
  assert.deepEqual([...first.idMap], [...second.idMap]);
});

test("insertion drops dangling edges and preserves unknown definitions", () => {
  const target: Diagram = {
    nodes: [{ id: "existing", def: "api", x: 0, y: 0, label: "Existing" }],
    edges: [],
  };
  const result = insertIntoDiagram(
    target,
    {
      format: "anatomia",
      version: 1,
      meta: { title: "Future lesson", catalogVersion: "future" },
      nodes: [
        { id: "future-node", def: "future-service", x: 10, y: 20, label: "Future" },
      ],
      edges: [
        { id: "future-valid", from: "future-node", to: "future-node", label: "loop" },
        { id: "future-dangling", from: "future-node", to: "missing", label: "drop" },
      ],
    },
    (kind, sourceId, attempt) => `${kind}-${sourceId}-${attempt}`,
  );

  assert.equal(result.ok, true);
  assert.equal(result.inserted.nodes[0]?.def, "future-service");
  assert.deepEqual(
    result.inserted.edges.map((edge) => edge.label),
    ["loop"],
  );
  assert.ok(result.warnings.some((warning) => warning.includes("dangling endpoint")));
});
