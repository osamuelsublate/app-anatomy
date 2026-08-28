import assert from "node:assert/strict";
import test from "node:test";

import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, parseThemePreference, themeCssVariables } from "../src/theme.js";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
}

function contrast(a: string, b: string): number {
  const [bright, dark] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (bright! + .05) / (dark! + .05);
}

test("all category themes meet text and non-text WCAG contrast", () => {
  for (const theme of [LIGHT_THEME, DARK_THEME]) {
    for (const [key, colors] of Object.entries(theme.categories)) {
      assert.ok(contrast(colors.ink, colors.fill) >= 4.5, `${theme.name}/${key} text contrast`);
      assert.ok(contrast(colors.stroke, colors.fill) >= 3, `${theme.name}/${key} stroke contrast`);
    }
  }
});

test("theme preference uses an isolated key and safely falls back to light", () => {
  assert.equal(THEME_STORAGE_KEY, "app-anatomy:theme");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("invalid"), "light");
  assert.equal(parseThemePreference(null), "light");
});

test("theme variables expose every semantic UI token without document fields", () => {
  for (const theme of [LIGHT_THEME, DARK_THEME]) {
    const variables = themeCssVariables(theme);
    assert.deepEqual(Object.keys(variables).sort(), [
      "--accent", "--accent-soft", "--bg-canvas", "--border", "--danger", "--danger-soft",
      "--dot", "--ink", "--ink-muted", "--surface", "--surface-2",
    ]);
    assert.equal("theme" in theme, false);
  }
});
