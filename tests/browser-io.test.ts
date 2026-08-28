import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserIo,
  MAX_PNG_PIXELS,
  MAX_PNG_SIDE,
  PNG_SCALE,
  type BrowserCanvas,
  type BrowserImage,
  type BrowserIoDependencies,
} from "../src/browser-io.js";
import type { Diagram, DiagramFile } from "../src/types.js";

const diagram: Diagram = {
  nodes: [{ id: "node", def: "api", x: 0, y: 0, label: "Document only" }],
  edges: [],
};

const file: DiagramFile = {
  format: "anatomia",
  version: 1,
  meta: { title: "Test" },
  ...diagram,
};

interface HarnessOptions {
  image?: "load" | "error" | "pending" | "throw";
  canvas?: "present" | "throw";
  context?: "present" | "missing" | "throw";
  toBlob?: "blob" | "null" | "pending" | "throw";
  draw?: "ok" | "throw";
  blob?: "ok" | "throw";
  objectUrlFailureAt?: number;
  click?: "ok" | "throw";
  revoke?: "ok" | "throw";
  timeoutMs?: number;
}

function harness(options: HarnessOptions = {}) {
  const blobs: Blob[] = [];
  const clicks: Array<{ href: string; download: string }> = [];
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  const canvasSizes: Array<{ width: number; height: number }> = [];
  const timers = new Map<number, () => void>();
  const timeoutDelays: number[] = [];
  let nextTimer = 1;
  let pendingBlobCallback: ((blob: Blob | null) => void) | null = null;

  class FakeImage implements BrowserImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    #src = "";

    get src(): string {
      return this.#src;
    }

    set src(value: string) {
      if (options.image === "throw") throw new Error("src failed");
      this.#src = value;
      if (options.image === "error") this.onerror?.();
      else if (options.image !== "pending") this.onload?.();
    }
  }

  const dependencies: BrowserIoDependencies = {
    createBlob(parts, blobOptions) {
      if (options.blob === "throw") throw new Error("blob failed");
      const blob = new Blob(parts, blobOptions);
      blobs.push(blob);
      return blob;
    },
    createImage: () => new FakeImage(),
    createCanvas() {
      if (options.canvas === "throw") throw new Error("canvas failed");
      let width = 0;
      let height = 0;
      const canvas: BrowserCanvas = {
        get width() {
          return width;
        },
        set width(value: number) {
          width = value;
        },
        get height() {
          return height;
        },
        set height(value: number) {
          height = value;
          canvasSizes.push({ width, height });
        },
        getContext() {
          if (options.context === "throw") throw new Error("context failed");
          if (options.context === "missing") return null;
          return {
            scale() {
              if (options.draw === "throw") throw new Error("scale failed");
            },
            drawImage() {
              if (options.draw === "throw") throw new Error("draw failed");
            },
          };
        },
        toBlob(callback) {
          if (options.toBlob === "throw") throw new Error("encoding failed");
          if (options.toBlob === "pending") {
            pendingBlobCallback = callback;
            return;
          }
          callback(options.toBlob === "null" ? null : new Blob(["png"], { type: "image/png" }));
        },
      };
      return canvas;
    },
    createAnchor: () => ({
      href: "",
      download: "",
      click() {
        clicks.push({ href: this.href, download: this.download });
        if (options.click === "throw") throw new Error("click failed");
      },
    }),
    createObjectURL(blob) {
      blobs.push(blob);
      const call = createdUrls.length + 1;
      if (options.objectUrlFailureAt === call) throw new Error("URL failed");
      const url = `blob:test-${call}`;
      createdUrls.push(url);
      return url;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
      if (options.revoke === "throw") throw new Error("revoke failed");
    },
    scheduleTimeout(callback, delayMs) {
      const handle = nextTimer++;
      timers.set(handle, callback);
      timeoutDelays.push(delayMs);
      return handle;
    },
    cancelTimeout(handle) {
      timers.delete(handle as number);
    },
  };

  return {
    io: createBrowserIo(dependencies, { pngTimeoutMs: options.timeoutMs }),
    blobs,
    clicks,
    createdUrls,
    revokedUrls,
    canvasSizes,
    timeoutDelays,
    runTimeout() {
      const entry = timers.entries().next().value as [number, () => void] | undefined;
      if (!entry) return;
      timers.delete(entry[0]);
      entry[1]();
    },
    completeBlob(blob: Blob | null = new Blob(["late"], { type: "image/png" })) {
      const callback = pendingBlobCallback;
      pendingBlobCallback = null;
      callback?.(blob);
    },
  };
}

function spacedDiagram(x: number, y: number): Diagram {
  return {
    nodes: [
      { id: "first", def: "api", x: 0, y: 0, label: "First" },
      { id: "last", def: "sql", x, y, label: "Last" },
    ],
    edges: [],
  };
}

test("PNG export enforces maximum raster side before browser allocation", async () => {
  const state = harness();
  const result = await state.io.exportPng(spacedDiagram(4_100, 0));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "raster-too-large");
  assert.match(result.message, new RegExp(String(MAX_PNG_SIDE)));
  assert.match(result.message, /Exporte como SVG/);
  assert.deepEqual(state.createdUrls, []);
  assert.deepEqual(state.canvasSizes, []);
});

test("PNG export enforces maximum pixel count even when both sides fit", async () => {
  const state = harness();
  const result = await state.io.exportPng(spacedDiagram(3_700, 3_700));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "raster-too-large");
  assert.match(result.message, /Exporte como SVG/);
  assert.ok(MAX_PNG_PIXELS < MAX_PNG_SIDE * MAX_PNG_SIDE);
});

test("successful PNG export scales the canvas and revokes source and download URLs", async () => {
  const state = harness();
  const result = await state.io.exportPng(diagram, "custom.png");

  assert.deepEqual(result, { ok: true, message: "Download PNG iniciado." });
  assert.deepEqual(state.canvasSizes, [{ width: 246 * PNG_SCALE, height: 200 * PNG_SCALE }]);
  assert.deepEqual(state.createdUrls, ["blob:test-1", "blob:test-2"]);
  assert.deepEqual(state.revokedUrls, ["blob:test-2", "blob:test-1"]);
  assert.deepEqual(state.clicks, [{ href: "blob:test-2", download: "custom.png" }]);
});

test("PNG reports image load failures and revokes its source URL", async () => {
  const state = harness({ image: "error" });
  const result = await state.io.exportPng(diagram);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "image-load-failed");
  assert.match(result.message, /Exporte como SVG/);
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
});

test("PNG reports missing canvas context and revokes its source URL", async () => {
  const state = harness({ context: "missing" });
  const result = await state.io.exportPng(diagram);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "canvas-context-missing");
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
});

test("PNG reports null toBlob output and revokes its source URL", async () => {
  const state = harness({ toBlob: "null" });
  const result = await state.io.exportPng(diagram);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "png-encoding-failed");
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
});

test("PNG times out stalled image loading and revokes its source URL exactly once", async () => {
  const state = harness({ image: "pending", timeoutMs: 123 });
  const exporting = state.io.exportPng(diagram);
  assert.deepEqual(state.timeoutDelays, [123]);

  state.runTimeout();
  const result = await exporting;

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "png-timeout");
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
  state.runTimeout();
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
});

test("PNG times out a missing toBlob callback and ignores late completion", async () => {
  const state = harness({ toBlob: "pending" });
  const exporting = state.io.exportPng(diagram);

  state.runTimeout();
  const result = await exporting;

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "png-timeout");
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
  state.completeBlob();
  assert.deepEqual(state.createdUrls, ["blob:test-1"]);
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
  assert.deepEqual(state.clicks, []);
});

test("PNG maps synchronous browser adapter failures to explicit errors", async () => {
  const cases: Array<{ options: HarnessOptions; code: string }> = [
    { options: { image: "throw" }, code: "image-load-failed" },
    { options: { canvas: "throw" }, code: "canvas-creation-failed" },
    { options: { context: "throw" }, code: "canvas-context-missing" },
    { options: { draw: "throw" }, code: "canvas-draw-failed" },
    { options: { toBlob: "throw" }, code: "png-encoding-failed" },
  ];

  for (const { options, code } of cases) {
    const state = harness(options);
    const result = await state.io.exportPng(diagram);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
  }
});

test("PNG reports click failure while revoking both object URLs", async () => {
  const state = harness({ click: "throw" });
  const result = await state.io.exportPng(diagram);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "click-failed");
  assert.deepEqual(state.revokedUrls, ["blob:test-2", "blob:test-1"]);
});

test("PNG reports object URL and cleanup failures explicitly", async () => {
  const sourceFailure = harness({ objectUrlFailureAt: 1 });
  const failedSource = await sourceFailure.io.exportPng(diagram);
  assert.equal(failedSource.ok, false);
  if (!failedSource.ok) assert.equal(failedSource.code, "object-url-failed");

  const downloadFailure = harness({ objectUrlFailureAt: 2 });
  const failedDownload = await downloadFailure.io.exportPng(diagram);
  assert.equal(failedDownload.ok, false);
  if (!failedDownload.ok) assert.equal(failedDownload.code, "object-url-failed");
  assert.deepEqual(downloadFailure.revokedUrls, ["blob:test-1"]);

  const cleanupFailure = harness({ revoke: "throw" });
  const failedCleanup = await cleanupFailure.io.exportPng(diagram);
  assert.equal(failedCleanup.ok, false);
  if (!failedCleanup.ok) assert.equal(failedCleanup.code, "object-url-cleanup-failed");
  assert.deepEqual(cleanupFailure.revokedUrls, ["blob:test-2", "blob:test-1"]);
});

test("SVG helper downloads document-only markup and cleans up its URL", async () => {
  const state = harness();
  const result = state.io.downloadSvg(diagram, "diagram.svg");

  assert.deepEqual(result, { ok: true, message: "Download SVG iniciado." });
  assert.deepEqual(state.clicks, [{ href: "blob:test-1", download: "diagram.svg" }]);
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);
  const svg = await state.blobs[0]!.text();
  assert.match(svg, /Document only/);
  assert.ok(!svg.includes('stroke="#4a8ff7"'));
  assert.ok(!svg.includes('stroke="#e8823e"'));
});

test("JSON helper serializes the file and reports Blob and click failures", async () => {
  const state = harness();
  const result = state.io.downloadJson(file);

  assert.deepEqual(result, { ok: true, message: "Download JSON iniciado." });
  assert.deepEqual(JSON.parse(await state.blobs[0]!.text()), file);
  assert.deepEqual(state.revokedUrls, ["blob:test-1"]);

  const blobFailure = harness({ blob: "throw" }).io.downloadJson(file);
  assert.equal(blobFailure.ok, false);
  if (!blobFailure.ok) assert.equal(blobFailure.code, "blob-creation-failed");

  const clickState = harness({ click: "throw" });
  const clickFailure = clickState.io.downloadJson(file);
  assert.equal(clickFailure.ok, false);
  if (!clickFailure.ok) assert.equal(clickFailure.code, "click-failed");
  assert.deepEqual(clickState.revokedUrls, ["blob:test-1"]);
});

test("empty diagrams return explicit errors without creating browser resources", async () => {
  const state = harness();

  assert.deepEqual(state.io.downloadSvg({ nodes: [], edges: [] }), {
    ok: false,
    code: "empty-diagram",
    message: "SVG não exportado: o diagrama está vazio.",
  });
  const png = await state.io.exportPng({ nodes: [], edges: [] });
  assert.equal(png.ok, false);
  if (!png.ok) assert.equal(png.code, "empty-diagram");
  assert.deepEqual(state.createdUrls, []);
});
