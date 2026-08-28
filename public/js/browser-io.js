import { buildExportSvg } from "./markup.js";
import { DOCUMENT_KEY_PREFIX, isSafeDocumentId } from "./document-storage.js";
const UI_ICON_FILES = Object.freeze({
    menu: "menu.svg",
    undo: "undo-2.svg",
    redo: "redo-2.svg",
    presentation: "presentation.svg",
    maximize: "maximize.svg",
    heart: "heart-pulse.svg",
});
export function uiIconMarkup(name, label = "") {
    const file = UI_ICON_FILES[name];
    const alt = label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    return `<img src="icons/ui/${file}" width="20" height="20" alt="${alt}">`;
}
export const PNG_SCALE = 2;
export const MAX_PNG_SIDE = 8_192;
export const MAX_PNG_PIXELS = 32_000_000;
export const PNG_EXPORT_TIMEOUT_MS = 10_000;
export function isTextEntryTarget(target) {
    return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
}
export function focusedNodeId(target) {
    if (!(target instanceof Element))
        return null;
    return target.closest("[data-node-id]")?.dataset["nodeId"] ?? null;
}
export function bindBrowserLifecycle(lifecycle) {
    window.addEventListener("storage", (event) => {
        if (!event.key?.startsWith(DOCUMENT_KEY_PREFIX))
            return;
        const documentId = event.key.slice(DOCUMENT_KEY_PREFIX.length);
        if (!isSafeDocumentId(documentId))
            return;
        const result = lifecycle.externalDocument(documentId);
        if (result === "reloaded") {
            lifecycle.reloadDocument();
            lifecycle.status.show("Diagrama atualizado por outra aba.");
        }
        else if (result === "missing") {
            lifecycle.status.show("O diagrama foi removido ou ficou ilegível em outra aba.", true);
        }
    });
    window.addEventListener("pagehide", lifecycle.flush);
    window.addEventListener("resize", lifecycle.refreshLayout);
    window.addEventListener("scroll", lifecycle.refreshLayout, true);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden")
            lifecycle.flush();
    });
}
export function createBrowserLiveStatus(element) {
    let pendingStorage = null;
    const show = (message, isError = false) => {
        element.textContent = message;
        element.classList.toggle("error", isError);
    };
    return {
        show,
        reportExport(result) {
            show(result.message, !result.ok);
        },
        reportStorage(issue) {
            const source = { read: "Leitura", migration: "Migração", persistence: "Armazenamento", external: "Outra aba" }[issue.source];
            const conflict = issue.source === "external"
                && issue.warnings.some((warning) => warning.includes("conflicts"));
            pendingStorage = {
                message: conflict
                    ? "Conflito com outra aba: suas alterações locais foram preservadas."
                    : `${source}: ${[...issue.errors, ...issue.warnings].join("; ")}`,
                isError: issue.errors.length > 0 || conflict,
            };
        },
        reportModel(message, isError) {
            const status = pendingStorage;
            pendingStorage = null;
            show(status?.message ?? message, status?.isError ?? isError);
        },
    };
}
export function bindBrowserExports(controls, source, report, io = createBrowserIo()) {
    controls.png.addEventListener("click", () => {
        void io.exportPng(source.diagram()).then(report);
    });
    controls.svg.addEventListener("click", () => report(io.downloadSvg(source.diagram())));
    controls.json.addEventListener("click", () => report(io.downloadJson(source.file())));
}
function failure(code, message) {
    return { ok: false, code, message };
}
function defaultDependencies() {
    return {
        createBlob: (parts, options) => new Blob(parts, options),
        createImage: () => new Image(),
        createCanvas: () => document.createElement("canvas"),
        createAnchor: () => document.createElement("a"),
        createObjectURL: (blob) => URL.createObjectURL(blob),
        revokeObjectURL: (url) => URL.revokeObjectURL(url),
    };
}
function pngLimitError(output) {
    const width = output.w * PNG_SCALE;
    const height = output.h * PNG_SCALE;
    const pixels = width * height;
    if (!Number.isSafeInteger(width)
        || !Number.isSafeInteger(height)
        || width <= 0
        || height <= 0
        || width > MAX_PNG_SIDE
        || height > MAX_PNG_SIDE
        || pixels > MAX_PNG_PIXELS) {
        return failure("raster-too-large", `PNG não exportado: raster de ${width}×${height} px excede o limite seguro de ${MAX_PNG_SIDE} px por lado e ${MAX_PNG_PIXELS.toLocaleString("pt-BR")} pixels. Exporte como SVG.`);
    }
    return null;
}
export function createBrowserIo(dependencies = defaultDependencies(), options = {}) {
    const scheduleTimeout = dependencies.scheduleTimeout
        ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    const cancelTimeout = dependencies.cancelTimeout
        ?? ((handle) => globalThis.clearTimeout(handle));
    const pngTimeoutMs = options.pngTimeoutMs ?? PNG_EXPORT_TIMEOUT_MS;
    function createBlob(parts, options) {
        try {
            return { ok: true, blob: dependencies.createBlob(parts, options) };
        }
        catch {
            return {
                ok: false,
                result: failure("blob-creation-failed", "Não foi possível preparar o arquivo para download."),
            };
        }
    }
    function downloadBlob(filename, blob, label) {
        let url;
        try {
            url = dependencies.createObjectURL(blob);
        }
        catch {
            return failure("object-url-failed", `Não foi possível criar o download ${label}.`);
        }
        let clickFailed = false;
        try {
            const anchor = dependencies.createAnchor();
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
        }
        catch {
            clickFailed = true;
        }
        try {
            dependencies.revokeObjectURL(url);
        }
        catch {
            return failure("object-url-cleanup-failed", clickFailed
                ? `O download ${label} falhou e o recurso temporário não pôde ser liberado.`
                : `O download ${label} foi iniciado, mas o recurso temporário não pôde ser liberado.`);
        }
        return clickFailed
            ? failure("click-failed", `Não foi possível iniciar o download ${label}.`)
            : { ok: true, message: `Download ${label} iniciado.` };
    }
    function downloadSvg(diagram, filename = "anatomia-diagrama.svg") {
        const output = buildExportSvg(diagram);
        if (!output) {
            return failure("empty-diagram", "SVG não exportado: o diagrama está vazio.");
        }
        const created = createBlob([output.svg], { type: "image/svg+xml;charset=utf-8" });
        return created.ok ? downloadBlob(filename, created.blob, "SVG") : created.result;
    }
    function downloadJson(file, filename = "anatomia-diagrama.json") {
        const created = createBlob([JSON.stringify(file, null, 2)], { type: "application/json;charset=utf-8" });
        return created.ok ? downloadBlob(filename, created.blob, "JSON") : created.result;
    }
    async function exportPng(diagram, filename = "anatomia-diagrama.png") {
        const output = buildExportSvg(diagram);
        if (!output) {
            return failure("empty-diagram", "PNG não exportado: o diagrama está vazio.");
        }
        const limitError = pngLimitError(output);
        if (limitError)
            return limitError;
        const source = createBlob([output.svg], { type: "image/svg+xml;charset=utf-8" });
        if (!source.ok)
            return source.result;
        let sourceUrl;
        try {
            sourceUrl = dependencies.createObjectURL(source.blob);
        }
        catch {
            return failure("object-url-failed", "Não foi possível preparar o SVG para gerar o PNG.");
        }
        return new Promise((resolve) => {
            let settled = false;
            let timeoutHandle = null;
            let image;
            try {
                image = dependencies.createImage();
            }
            catch {
                try {
                    dependencies.revokeObjectURL(sourceUrl);
                }
                catch {
                    resolve(failure("object-url-cleanup-failed", "PNG não exportado e o recurso temporário do SVG não pôde ser liberado."));
                    return;
                }
                resolve(failure("image-load-failed", "PNG não exportado: o navegador não conseguiu criar a imagem. Tente exportar como SVG."));
                return;
            }
            const finish = (result) => {
                if (settled)
                    return;
                settled = true;
                if (timeoutHandle !== null) {
                    cancelTimeout(timeoutHandle);
                    timeoutHandle = null;
                }
                image.onload = null;
                image.onerror = null;
                try {
                    dependencies.revokeObjectURL(sourceUrl);
                }
                catch {
                    resolve(failure("object-url-cleanup-failed", `${result.message} O recurso temporário do SVG não pôde ser liberado.`));
                    return;
                }
                resolve(result);
            };
            image.onerror = () => finish(failure("image-load-failed", "PNG não exportado: o navegador não conseguiu carregar o SVG. Exporte como SVG."));
            image.onload = () => {
                if (settled)
                    return;
                let canvas;
                try {
                    canvas = dependencies.createCanvas();
                }
                catch {
                    finish(failure("canvas-creation-failed", "PNG não exportado: não foi possível criar o canvas."));
                    return;
                }
                canvas.width = output.w * PNG_SCALE;
                canvas.height = output.h * PNG_SCALE;
                let context;
                try {
                    context = canvas.getContext("2d");
                }
                catch {
                    finish(failure("canvas-context-missing", "PNG não exportado: o navegador não disponibilizou o contexto 2D. Exporte como SVG."));
                    return;
                }
                if (!context) {
                    finish(failure("canvas-context-missing", "PNG não exportado: o navegador não disponibilizou o contexto 2D. Exporte como SVG."));
                    return;
                }
                try {
                    context.scale(PNG_SCALE, PNG_SCALE);
                    context.drawImage(image, 0, 0);
                }
                catch {
                    finish(failure("canvas-draw-failed", "PNG não exportado: o navegador não conseguiu desenhar a imagem. Exporte como SVG."));
                    return;
                }
                try {
                    canvas.toBlob((blob) => {
                        if (settled)
                            return;
                        if (!blob) {
                            finish(failure("png-encoding-failed", "PNG não exportado: o navegador não conseguiu codificar a imagem. Exporte como SVG."));
                            return;
                        }
                        finish(downloadBlob(filename, blob, "PNG"));
                    }, "image/png");
                }
                catch {
                    finish(failure("png-encoding-failed", "PNG não exportado: o navegador não conseguiu codificar a imagem. Exporte como SVG."));
                }
            };
            try {
                timeoutHandle = scheduleTimeout(() => finish(failure("png-timeout", "PNG não exportado: o navegador demorou demais para carregar ou codificar a imagem. Exporte como SVG.")), pngTimeoutMs);
            }
            catch {
                finish(failure("png-timeout", "PNG não exportado: não foi possível controlar o tempo da exportação. Exporte como SVG."));
                return;
            }
            try {
                image.src = sourceUrl;
            }
            catch {
                finish(failure("image-load-failed", "PNG não exportado: o navegador não conseguiu carregar o SVG. Exporte como SVG."));
            }
        });
    }
    return { exportPng, downloadSvg, downloadJson };
}
