import assert from "node:assert/strict";
import test from "node:test";

import * as catalogModule from "../src/catalog.js";
import { iconIdForEmoji } from "../src/twemoji.js";

const { CATEGORIAS, resolveDef } = catalogModule;
const contract = catalogModule as typeof catalogModule & {
  ALIASES?: Readonly<Record<string, string>>;
  CATALOG_VERSION?: unknown;
};

test("catalog exposes a non-empty version", () => {
  assert.ok(
    typeof contract.CATALOG_VERSION === "string" || typeof contract.CATALOG_VERSION === "number",
    "CATALOG_VERSION must be a string or number",
  );
  assert.ok(String(contract.CATALOG_VERSION).length > 0);
  assert.equal(String(contract.CATALOG_VERSION), "3");
});

test("category and block identifiers are unique and resolvable", () => {
  const categoryIds = CATEGORIAS.map((category) => category.id);
  const blocks = CATEGORIAS.flatMap((category) =>
    category.blocos.map((block) => ({ block, category })),
  );
  const blockIds = blocks.map(({ block }) => block.id);

  assert.equal(new Set(categoryIds).size, categoryIds.length);
  assert.equal(new Set(blockIds).size, blockIds.length);
  assert.equal(blocks.length, 63, "catalog baseline changed; version it intentionally");

  for (const { block, category } of blocks) {
    const resolved = resolveDef(block.id);
    assert.ok(resolved, `catalog block ${block.id} must resolve`);
    assert.equal(resolved.def, block);
    assert.equal(resolved.cat, category);
    assert.equal(block.iconId, iconIdForEmoji(block.icone));
    assert.match(block.iconId, /^twemoji-[0-9a-f-]+$/);
  }
  for (const category of CATEGORIAS) {
    assert.equal(category.iconId, iconIdForEmoji(category.icone));
  }
});

test("aliases are unambiguous and target live catalog definitions", () => {
  const aliases = contract.ALIASES;
  assert.ok(aliases && typeof aliases === "object", "catalog must export ALIASES");

  for (const [legacyId, currentId] of Object.entries(aliases)) {
    assert.match(legacyId, /^[A-Za-z0-9_-]+$/);
    assert.match(currentId, /^[A-Za-z0-9_-]+$/);
    assert.equal(resolveDef(legacyId), undefined, `alias ${legacyId} shadows a live block`);
    assert.ok(resolveDef(currentId), `alias ${legacyId} targets missing block ${currentId}`);
  }
});

test("audited semantic and ZWJ icons map to one pinned Twemoji symbol each", () => {
  assert.equal(resolveDef("k8s")?.def.iconId, "twemoji-2638");
  assert.equal(resolveDef("navegador")?.def.iconId, "twemoji-1f9ed");
  assert.equal(resolveDef("atacante")?.def.iconId, "twemoji-1f575");
  assert.equal(resolveDef("dev")?.def.iconId, "twemoji-1f469-200d-1f4bb");
  assert.equal(resolveDef("ops")?.def.iconId, "twemoji-1f9d1-200d-1f527");
});
