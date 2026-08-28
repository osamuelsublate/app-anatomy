import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TWEMOJI_ICON_IDS,
  TWEMOJI_LICENSE,
  TWEMOJI_SOURCE_SHA256,
  TWEMOJI_SPRITE_SHA256,
  TWEMOJI_TAG,
  TWEMOJI_VERSION,
  twemojiSymbolDefs,
} from "../src/twemoji.js";

test("Twemoji source and local subset are pinned with reproducible checksums", async () => {
  const sprite = await readFile(
    new URL("../../public/icons/catalog/twemoji-v17.0.3.svg", import.meta.url),
    "utf8",
  );
  assert.equal(TWEMOJI_VERSION, "17.0.3");
  assert.equal(TWEMOJI_TAG, "v17.0.3");
  assert.equal(TWEMOJI_LICENSE, "CC-BY-4.0");
  assert.equal(
    TWEMOJI_SOURCE_SHA256,
    "a0855654b633045ae2337537e77f1bb4361162f7fcd910e613eaab1d6d9c5fca",
  );
  assert.equal(createHash("sha256").update(sprite).digest("hex"), TWEMOJI_SPRITE_SHA256);
  assert.equal((sprite.match(/<symbol /g) ?? []).length, 65);
  assert.ok(!sprite.includes("<script"));
  assert.ok(!/\b(?:href|src)="https?:/i.test(sprite));
});

test("inline symbol definitions are complete, deduplicated, and internally referenced", () => {
  const defs = twemojiSymbolDefs([...TWEMOJI_ICON_IDS, TWEMOJI_ICON_IDS[0]!]);
  assert.equal((defs.match(/<symbol /g) ?? []).length, 65);
  for (const id of TWEMOJI_ICON_IDS) assert.match(defs, new RegExp(`id="${id}"`));
  assert.ok(!/\b(?:href|src)="https?:/i.test(defs));
});
