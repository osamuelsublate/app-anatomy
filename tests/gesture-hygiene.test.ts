import assert from "node:assert/strict";
import test from "node:test";
import {
  bindBrowserLifecycle,
  focusedNodeId,
  isTextEntryTarget,
  type BrowserLifecycle,
} from "../src/browser-io.js";
import { createFrameCoalescer } from "../src/model.js";

test("coalesces pointer samples into one frame and applies only the latest value", () => {
  const applied: number[] = [];
  const callbacks = new Map<number, () => void>();
  const cancelled: number[] = [];
  let nextHandle = 0;
  const coalescer = createFrameCoalescer(
    (value: number) => applied.push(value),
    (callback) => {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    (handle) => {
      cancelled.push(handle);
      callbacks.delete(handle);
    },
  );

  coalescer.schedule(10);
  coalescer.schedule(20);
  coalescer.schedule(30);

  assert.equal(callbacks.size, 1);
  callbacks.get(1)?.();
  assert.deepEqual(applied, [30]);

  coalescer.schedule(40);
  coalescer.flush();
  assert.deepEqual(applied, [30, 40]);
  assert.deepEqual(cancelled, [1, 2]);
  assert.equal(callbacks.size, 0);
});

test("cancel drops a pending pointer sample and allows a fresh frame", () => {
  const applied: string[] = [];
  const callbacks = new Map<number, () => void>();
  const cancelled: number[] = [];
  let nextHandle = 0;
  const coalescer = createFrameCoalescer(
    (value: string) => applied.push(value),
    (callback) => {
      callbacks.set(++nextHandle, callback);
      return nextHandle;
    },
    (handle) => {
      cancelled.push(handle);
      callbacks.delete(handle);
    },
  );

  coalescer.schedule("stale");
  coalescer.cancel();
  coalescer.flush();
  coalescer.schedule("fresh");
  callbacks.get(2)?.();

  assert.deepEqual(cancelled, [1, 2]);
  assert.deepEqual(applied, ["fresh"]);
});

class EventHub {
  readonly listeners = new Map<string, Array<EventListenerOrEventListenerObject>>();
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  emit(type: string, event: Event = new Event(type)): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  }
}

function installGlobal(name: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  };
}

test("browser lifecycle flushes, refreshes, and routes valid external document events", () => {
  const fakeWindow = new EventHub();
  const fakeDocument = new EventHub() as EventHub & { visibilityState: string };
  fakeDocument.visibilityState = "visible";
  const restoreWindow = installGlobal("window", fakeWindow);
  const restoreDocument = installGlobal("document", fakeDocument);
  try {
    const effects: string[] = [];
    const externalIds: string[] = [];
    let externalResult: ReturnType<BrowserLifecycle["externalDocument"]> = "ignored";
    bindBrowserLifecycle({
      flush() { effects.push("flush"); },
      refreshLayout() { effects.push("refresh"); },
      externalDocument(id) {
        externalIds.push(id);
        return externalResult;
      },
      reloadDocument() { effects.push("reload"); },
      status: {
        show(message, isError = false) { effects.push(`${isError ? "error" : "status"}:${message}`); },
        reportExport() {},
        reportStorage() {},
        reportModel() {},
      },
    });

    fakeWindow.emit("pagehide");
    fakeWindow.emit("resize");
    fakeWindow.emit("scroll");
    fakeDocument.visibilityState = "hidden";
    fakeDocument.emit("visibilitychange");

    const unrelated = new Event("storage");
    Object.defineProperty(unrelated, "key", { value: "other:key" });
    fakeWindow.emit("storage", unrelated);

    externalResult = "reloaded";
    const reloaded = new Event("storage");
    Object.defineProperty(reloaded, "key", { value: "app-anatomy:document:valid-id" });
    fakeWindow.emit("storage", reloaded);

    externalResult = "missing";
    const missing = new Event("storage");
    Object.defineProperty(missing, "key", { value: "app-anatomy:document:missing-id" });
    fakeWindow.emit("storage", missing);

    assert.deepEqual(externalIds, ["valid-id", "missing-id"]);
    assert.deepEqual(effects.slice(0, 4), ["flush", "refresh", "refresh", "flush"]);
    assert.equal(effects.includes("reload"), true);
    assert.equal(effects.some((effect) => effect.startsWith("status:Diagrama atualizado")), true);
    assert.equal(effects.some((effect) => effect.startsWith("error:O diagrama foi removido")), true);
  } finally {
    restoreDocument();
    restoreWindow();
  }
});

test("text-entry detection covers form controls and editable elements", () => {
  class FakeHtmlElement extends EventTarget {
    isContentEditable = false;
  }
  class FakeInput extends FakeHtmlElement {}
  class FakeTextArea extends FakeHtmlElement {}
  class FakeSelect extends FakeHtmlElement {}
  const restores = [
    installGlobal("HTMLElement", FakeHtmlElement),
    installGlobal("HTMLInputElement", FakeInput),
    installGlobal("HTMLTextAreaElement", FakeTextArea),
    installGlobal("HTMLSelectElement", FakeSelect),
  ];
  try {
    const editable = new FakeHtmlElement();
    editable.isContentEditable = true;
    assert.equal(isTextEntryTarget(new FakeInput()), true);
    assert.equal(isTextEntryTarget(new FakeTextArea()), true);
    assert.equal(isTextEntryTarget(new FakeSelect()), true);
    assert.equal(isTextEntryTarget(editable), true);
    assert.equal(isTextEntryTarget(new FakeHtmlElement()), false);
    assert.equal(isTextEntryTarget(null), false);
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});

test("node focus resolves its selection so keyboard users can reach its ports", () => {
  class FakeElement extends EventTarget {
    dataset: Record<string, string> = {};
    parent: FakeElement | null = null;
    closest(selector: string): FakeElement | null {
      if (selector === "[data-node-id]" && this.dataset["nodeId"]) return this;
      return this.parent?.closest(selector) ?? null;
    }
  }
  const restoreElement = installGlobal("Element", FakeElement);
  try {
    const node = new FakeElement();
    node.dataset["nodeId"] = "keyboard-node";
    const child = new FakeElement();
    child.parent = node;

    assert.equal(focusedNodeId(node), "keyboard-node");
    assert.equal(focusedNodeId(child), "keyboard-node");
    assert.equal(focusedNodeId(new EventTarget()), null);
    assert.equal(focusedNodeId(null), null);
  } finally {
    restoreElement();
  }
});
