import { bindBrowserExports, bindBrowserLifecycle, createBrowserLiveStatus, focusedNodeId, isTextEntryTarget, } from "./browser-io.js";
import { createCanvasRenderer } from "./canvas-renderer.js";
import { ESSENTIAL_BLOCK_IDS, resolveDef } from "./catalog.js";
import { alignmentGuides, diagramToScreen, edgeRoute, fitDiagram, nearestSegmentIndex, nodeHeight, nodeWidth, screenToDiagram, snapPoint, zoomAround, } from "./geometry.js";
import { normalizeDiagramNodeSize, readDiagramFile } from "./format.js";
import { NODE_HEIGHT, NODE_WIDTH, paletteMarkup, presentationDiagram } from "./markup.js";
import { createApplicationModel, createFrameCoalescer, } from "./model.js";
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, parseThemePreference, themeCssVariables, } from "./theme.js";
import { glyphSvg } from "./icons.js";
function $(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`elemento não encontrado: ${selector}`);
    return element;
}
const canvas = $("#canvas");
const canvasWrap = $("#canvasWrap");
const cats = $("#cats");
const search = $("#search");
const hint = $("#hint");
const labelEditor = $("#labelEditor");
const fileInput = $("#fileInput");
const saveStatus = $("#saveStatus");
const announcer = $("#announcer");
const documentSelect = $("#documentSelect");
const documentTitle = $("#documentTitle");
const templateSelect = $("#templateSelect");
const quickPicker = $("#quickPicker");
const quickSearch = $("#quickSearch");
const quickResults = $("#quickResults");
const shortcuts = $("#shortcutsOverlay");
const fileMenu = $("#fileMenu");
const fileMenuButton = $("#btnFileMenu");
const colorPanel = $("#colorPanel");
const colorCustom = $("#colorCustom");
const contextMenu = $("#contextMenu");
const btnPalette = $("#btnPalette");
const PALETTE_STORAGE_KEY = "app-anatomy:palette";
const MENU_SWATCH_COLORS = [
    "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#8E8E93",
];
const world = document.createElementNS("http://www.w3.org/2000/svg", "g");
const documentLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
const interactionLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
const overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
documentLayer.id = "document-layer";
interactionLayer.id = "interaction-layer";
overlayLayer.id = "overlay-layer";
overlayLayer.setAttribute("pointer-events", "none");
world.append(documentLayer, interactionLayer, overlayLayer);
canvas.append(world);
const renderer = createCanvasRenderer(documentLayer, interactionLayer, overlayLayer);
function storedTheme() {
    try {
        return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    }
    catch {
        return "light";
    }
}
let currentTheme = storedTheme() === "dark" ? DARK_THEME : LIGHT_THEME;
for (const [name, value] of Object.entries(themeCssVariables(currentTheme))) {
    document.documentElement.style.setProperty(name, value);
}
document.documentElement.dataset["theme"] = currentTheme.name;
// Refração de borda (progressive enhancement): só Chromium aceita url() em
// backdrop-filter; nos demais o valor não serializa e o vidro fica só com blur.
{
    const probe = document.createElement("div");
    probe.style.backdropFilter = "url(#lg-dist)";
    if (probe.style.backdropFilter.includes("url")) {
        document.documentElement.classList.add("refract");
    }
}
let viewport = { x: 0, y: 0, zoom: 1 };
let cascade = 0;
let gestureRect = null;
let drag = null;
let resizing = null;
let portDrag = null;
/**
 * Gesto sobre uma conexão: arrastar a linha cria um waypoint (index null até
 * cruzar o limiar) e arrastar uma alça move o waypoint existente.
 */
let edgeDrag = null;
let panning = null;
let editing = null;
let activePointerId = null;
let activeGuides = [];
let quickFrom = null;
let quickAt = null;
let shortcutReturnFocus = null;
let laser = null;
let presentation = null;
const status = createBrowserLiveStatus(saveStatus);
function announce(message) {
    announcer.textContent = "";
    requestAnimationFrame(() => { announcer.textContent = message; });
}
const app = createApplicationModel(() => localStorage, () => Math.random().toString(36).slice(2, 10), {
    onChange: renderForMode,
    onStatus(message, isError) {
        status.reportModel(message, isError);
        if (isError || (!message.startsWith("Salv") && !message.startsWith("Carregando")))
            announce(message);
    },
    onDocuments: refreshDocuments,
    onStorageWarning: status.reportStorage,
});
function visualState() {
    return { ...app.ui, guides: activeGuides, presentation: presentation !== null, laser };
}
function displayedDiagram() {
    return presentation ? presentationDiagram(app.file, presentation.revealed) : app.file;
}
function applyViewport() {
    world.setAttribute("transform", `translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`);
    canvasWrap.style.backgroundSize = `${24 * viewport.zoom}px ${24 * viewport.zoom}px`;
    canvasWrap.style.backgroundPosition = `${viewport.x}px ${viewport.y}px`;
    $("#btnZoomReset").textContent = `${Math.round(viewport.zoom * 100)}%`;
}
/** Grade de cores: aparece quando um bloco está selecionado e reflete o tint atual. */
function updateColorPanel() {
    const selected = !presentation && app.ui.selection?.kind === "node"
        ? app.nodeIndex.get(app.ui.selection.id)
        : undefined;
    colorPanel.hidden = !selected;
    if (!selected)
        return;
    const color = selected.color ?? "";
    for (const swatch of colorPanel.querySelectorAll("[data-color]")) {
        swatch.classList.toggle("active", (swatch.dataset["color"] ?? "") === color);
    }
    if (color)
        colorCustom.value = color;
}
function renderForMode(mode) {
    const diagram = displayedDiagram();
    if (mode === "transient" && drag)
        renderer.patchDrag(diagram, visualState(), drag.id, currentTheme);
    else if (mode === "transient" && (resizing || edgeDrag))
        renderer.renderFull(diagram, visualState(), currentTheme);
    else if (mode === "transient" && portDrag)
        renderer.renderOverlay(diagram, visualState(), currentTheme);
    else if (mode === "transient")
        renderer.renderUi(diagram, visualState(), currentTheme);
    else
        renderer.renderFull(diagram, visualState(), currentTheme);
    applyViewport();
    updateColorPanel();
    // Durante uma conexão, todas as portas ficam visíveis para o usuário poder
    // escolher a face de destino (estilo draw.io).
    document.body.classList.toggle("connecting", portDrag !== null || app.ui.connectFrom !== null);
}
function renderFull() {
    renderer.renderFull(displayedDiagram(), visualState(), currentTheme);
    applyViewport();
    updateColorPanel();
}
function refreshDocuments() {
    documentSelect.replaceChildren(...app.documents.map((summary) => {
        const option = document.createElement("option");
        option.value = summary.id;
        option.textContent = summary.title;
        return option;
    }));
    documentSelect.value = app.currentDocumentId ?? "";
    documentTitle.value = app.file.meta.title;
}
function fitView() {
    const rect = canvas.getBoundingClientRect();
    viewport = fitDiagram(app.file, rect.width, rect.height);
    applyViewport();
}
function setZoom(zoom) {
    const rect = canvas.getBoundingClientRect();
    viewport = zoomAround(viewport, zoom, rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
    applyViewport();
}
function applyTheme(name, persist = true) {
    currentTheme = name === "dark" ? DARK_THEME : LIGHT_THEME;
    document.documentElement.dataset["theme"] = name;
    for (const [token, value] of Object.entries(themeCssVariables(currentTheme))) {
        document.documentElement.style.setProperty(token, value);
    }
    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, name);
        }
        catch {
            status.show("Tema aplicado, mas a preferência não pôde ser salva.", true);
        }
    }
    cats.innerHTML = paletteMarkup(search.value, currentTheme);
    renderFull();
    $("#btnTheme").setAttribute("aria-label", name === "dark" ? "Usar tema claro" : "Usar tema escuro");
}
function enterPresentation() {
    if (presentation || app.file.nodes.length === 0)
        return;
    presentation = {
        revealed: 1,
        viewport: { ...viewport },
        returnFocus: document.activeElement,
        chromeCollapsed: document.body.classList.contains("chrome-collapsed"),
    };
    laser = null;
    closeEditor(false);
    closeQuickPicker();
    closeContextMenu();
    document.body.classList.remove("chrome-collapsed");
    document.body.classList.add("presentation-mode");
    const rect = canvas.getBoundingClientRect();
    viewport = fitDiagram(app.file, rect.width, rect.height, 36);
    renderFull();
    canvas.focus();
    announce("Apresentação iniciada. Use as setas para revelar o diagrama e Escape para sair.");
}
function exitPresentation() {
    const session = presentation;
    if (!session)
        return;
    presentation = null;
    laser = null;
    document.body.classList.remove("presentation-mode");
    document.body.classList.toggle("chrome-collapsed", session.chromeCollapsed);
    viewport = session.viewport;
    renderFull();
    session.returnFocus?.focus();
    announce("Apresentação encerrada.");
}
function revealPresentation(delta) {
    if (!presentation)
        return;
    presentation.revealed = Math.max(0, Math.min(app.file.nodes.length, presentation.revealed + delta));
    renderFull();
    announce(`${presentation.revealed} de ${app.file.nodes.length} blocos revelados.`);
}
function point(clientX, clientY) {
    return screenToDiagram(viewport, clientX, clientY, gestureRect ?? canvas.getBoundingClientRect());
}
function beginGesture() { gestureRect = canvas.getBoundingClientRect(); }
function endGesture() { gestureRect = null; activeGuides = []; }
function refreshGesture() { if (gestureRect)
    gestureRect = canvas.getBoundingClientRect(); }
function addNode(definitionId, clientX, clientY, offset = 0) {
    const target = point(clientX, clientY);
    const size = resolveDef(definitionId)?.def.defaultSize;
    const position = snapPoint({
        x: target.x - (size?.w ?? NODE_WIDTH) / 2 + offset,
        y: target.y - (size?.h ?? NODE_HEIGHT) / 2 + offset,
    });
    const id = app.addNode(definitionId, position.x, position.y);
    if (id)
        announce("Bloco criado.");
    return id;
}
function openEditor(target) {
    const screenPoint = diagramToScreen(viewport, target.x, target.y, canvas.getBoundingClientRect());
    const wrap = canvasWrap.getBoundingClientRect();
    editing = target;
    labelEditor.value = target.value;
    labelEditor.style.display = "block";
    labelEditor.style.left = `${screenPoint.x - wrap.left - 90}px`;
    labelEditor.style.top = `${screenPoint.y - wrap.top - 14}px`;
    labelEditor.focus();
    labelEditor.select();
}
function openSelectedEditor() {
    const selected = app.ui.selection;
    if (!selected)
        return;
    const target = app.editorTarget(selected);
    if (target)
        openEditor(target);
}
function closeEditor(save) {
    const target = editing;
    editing = null;
    labelEditor.style.display = "none";
    if (save && target)
        app.rename(target, labelEditor.value.trim());
}
const pointerMoves = createFrameCoalescer(({ x, y, free }) => {
    const target = point(x, y);
    if (drag) {
        const position = snapPoint({ x: target.x - drag.dx, y: target.y - drag.dy }, free);
        const candidate = app.nodeIndex.get(drag.id);
        if (candidate) {
            activeGuides = free ? [] : alignmentGuides({ ...candidate, ...position }, app.file.nodes);
        }
        app.moveNode(drag.id, position.x, position.y);
    }
    else if (resizing) {
        const pointer = snapPoint(target, free);
        const right = resizing.x + resizing.w;
        const bottom = resizing.y + resizing.h;
        let { x: nextX, y: nextY, w: nextW, h: nextH } = resizing;
        if (resizing.corner.includes("e"))
            nextW = normalizeDiagramNodeSize(pointer.x - resizing.x, "width");
        if (resizing.corner.includes("s"))
            nextH = normalizeDiagramNodeSize(pointer.y - resizing.y, "height");
        if (resizing.corner.includes("w")) {
            nextW = normalizeDiagramNodeSize(right - pointer.x, "width");
            nextX = right - nextW;
        }
        if (resizing.corner.includes("n")) {
            nextH = normalizeDiagramNodeSize(bottom - pointer.y, "height");
            nextY = bottom - nextH;
        }
        app.resizeNode(resizing.id, nextX, nextY, nextW, nextH);
    }
    else if (portDrag) {
        portDrag.moved = true;
        app.setConnectCursor(target);
    }
    else if (edgeDrag) {
        if (edgeDrag.index === null) {
            // Só cria o waypoint depois de um pequeno limiar, para o clique de
            // seleção não sujar a conexão.
            if (Math.hypot(target.x - edgeDrag.x, target.y - edgeDrag.y) * viewport.zoom < 4)
                return;
            const index = edgeInsertIndex(edgeDrag.id, edgeDrag.x, edgeDrag.y);
            if (index === null || !app.insertEdgePoint(edgeDrag.id, index, target.x, target.y)) {
                edgeDrag = null;
                return;
            }
            edgeDrag.index = index;
        }
        const position = snapPoint(target, free);
        app.moveEdgePoint(edgeDrag.id, edgeDrag.index, position.x, position.y);
    }
}, requestAnimationFrame, cancelAnimationFrame);
/**
 * Índice de inserção de um novo waypoint: o segmento da polilinha do usuário
 * (âncora → waypoints → âncora) mais próximo do ponto clicado.
 */
function edgeInsertIndex(edgeId, x, y) {
    const edge = app.file.edges.find((item) => item.id === edgeId);
    if (!edge)
        return null;
    const route = edgeRoute(edge, app.nodeIndex, app.file.edges);
    if (!route || route.pts.length < 2)
        return null;
    const start = route.pts[0];
    const end = route.pts[route.pts.length - 1];
    const userLine = [start, ...(edge.points ?? []), end];
    return nearestSegmentIndex(userLine, x, y);
}
function closeQuickPicker() {
    quickPicker.hidden = true;
    quickFrom = null;
    quickAt = null;
}
function renderQuickResults(query = "") {
    const normalized = query.trim().toLowerCase();
    const ids = normalized
        ? ESSENTIAL_BLOCK_IDS.filter((id) => {
            const resolved = resolveDef(id);
            return resolved && `${resolved.def.nome} ${resolved.def.desc}`.toLowerCase().includes(normalized);
        })
        : [...ESSENTIAL_BLOCK_IDS];
    quickResults.replaceChildren(...ids.map((id) => {
        const resolved = resolveDef(id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "block-item";
        button.dataset["def"] = id;
        button.innerHTML = `${glyphSvg(id, 18, "bi")}<span>${resolved.def.nome}</span>`;
        return button;
    }));
}
function placeQuickPicker(screenPoint) {
    const wrap = canvasWrap.getBoundingClientRect();
    quickPicker.style.left = `${Math.min(wrap.width - 245, Math.max(8, screenPoint.x - wrap.left + 8))}px`;
    quickPicker.style.top = `${Math.min(wrap.height - 300, Math.max(8, screenPoint.y - wrap.top + 8))}px`;
    quickPicker.hidden = false;
    quickSearch.value = "";
    renderQuickResults();
    quickSearch.focus();
}
function openQuickPicker(from, clientX, clientY) {
    quickFrom = from;
    quickAt = null;
    const node = app.nodeIndex.get(from);
    if (!node)
        return;
    quickSearch.placeholder = "Criar conectado…";
    placeQuickPicker(clientX === undefined
        ? diagramToScreen(viewport, node.x + nodeWidth(node), node.y + nodeHeight(node) / 2, canvas.getBoundingClientRect())
        : { x: clientX, y: clientY ?? 0 });
}
/** Picker do menu de contexto: cria um bloco solto na posição clicada. */
function openAddPicker(clientX, clientY) {
    quickFrom = null;
    quickAt = { x: clientX, y: clientY };
    quickSearch.placeholder = "Adicionar bloco…";
    placeQuickPicker({ x: clientX, y: clientY });
}
function quickCreate(definitionId) {
    if (!quickFrom) {
        const at = quickAt;
        closeQuickPicker();
        if (!at)
            return;
        const id = addNode(definitionId, at.x, at.y);
        if (id) {
            const target = app.editorTarget({ kind: "node", id });
            if (target)
                openEditor(target);
        }
        return;
    }
    const source = app.nodeIndex.get(quickFrom);
    if (!source)
        return closeQuickPicker();
    const id = app.addConnectedNode(quickFrom, definitionId, source.x + nodeWidth(source) + 72, source.y);
    closeQuickPicker();
    if (id) {
        const target = app.editorTarget({ kind: "node", id });
        if (target)
            openEditor(target);
    }
}
let hoveredPortsId = null;
/** Mostra as portas do bloco sob o cursor (como o draw.io faz ao pairar). */
function updateHoverPorts(target) {
    const element = target?.closest("[data-node-id],[data-ports-for],[data-port-node]");
    const id = element?.dataset["nodeId"] ?? element?.dataset["portsFor"] ?? element?.dataset["portNode"] ?? null;
    if (id === hoveredPortsId) {
        if (id)
            interactionLayer.querySelector(`[data-ports-for="${CSS.escape(id)}"]`)?.classList.add("hover");
        return;
    }
    if (hoveredPortsId) {
        interactionLayer.querySelector(`[data-ports-for="${CSS.escape(hoveredPortsId)}"]`)?.classList.remove("hover");
    }
    hoveredPortsId = id;
    if (id)
        interactionLayer.querySelector(`[data-ports-for="${CSS.escape(id)}"]`)?.classList.add("hover");
}
function finishPointerGesture(event) {
    if (activePointerId === null || event.pointerId !== activePointerId)
        return;
    pointerMoves.flush();
    if (drag) {
        app.finishTransient();
        drag = null;
        activeGuides = [];
        renderFull();
    }
    if (resizing) {
        app.finishTransient();
        resizing = null;
        renderFull();
    }
    if (edgeDrag) {
        if (edgeDrag.index !== null)
            app.finishTransient();
        edgeDrag = null;
        renderFull();
    }
    if (portDrag) {
        const source = portDrag.from;
        const fromSide = portDrag.fromSide;
        const moved = portDrag.moved;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-node-id],[data-port-node]");
        portDrag = null;
        app.cancelConnection();
        const targetId = target?.dataset["nodeId"] ?? target?.dataset["portNode"];
        if (moved && targetId) {
            // Soltar sobre uma porta fixa a face de destino; soltar no meio do bloco
            // mantém a âncora flutuante (face mais próxima, automática).
            const toSide = (target?.dataset["portNode"] ? target.dataset["portSide"] ?? null : null);
            app.connectNodes(source, targetId, {
                ...(fromSide ? { fromSide } : {}),
                ...(toSide ? { toSide } : {}),
            });
        }
        else if (!moved)
            openQuickPicker(source, event.clientX, event.clientY);
    }
    panning = null;
    activePointerId = null;
    endGesture();
}
function toggleFileMenu(open = fileMenu.hidden) {
    fileMenu.hidden = !open;
    fileMenuButton.setAttribute("aria-expanded", String(open));
    if (open)
        fileMenu.querySelector("button,select")?.focus();
    else
        fileMenuButton.focus();
}
function paletteHidden() {
    return document.body.classList.contains("palette-hidden");
}
/** Esconde/mostra o menu lateral, lembrando a preferência entre sessões. */
function setPaletteHidden(hidden, persist = true) {
    document.body.classList.toggle("palette-hidden", hidden);
    btnPalette.textContent = hidden ? "›" : "‹";
    const label = hidden ? "Mostrar menu lateral" : "Esconder menu lateral";
    btnPalette.title = label;
    btnPalette.setAttribute("aria-label", label);
    btnPalette.setAttribute("aria-expanded", String(!hidden));
    refreshGesture();
    if (!persist)
        return;
    try {
        localStorage.setItem(PALETTE_STORAGE_KEY, hidden ? "hidden" : "visible");
    }
    catch { /* preferência não persistida; segue só nesta sessão */ }
}
function storedPaletteHidden() {
    try {
        return localStorage.getItem(PALETTE_STORAGE_KEY) === "hidden";
    }
    catch {
        return false;
    }
}
let contextActions = new Map();
function closeContextMenu() {
    if (contextMenu.hidden)
        return;
    contextMenu.hidden = true;
    contextMenu.replaceChildren();
    contextActions = new Map();
}
function contextSwatchRow(nodeId) {
    const row = document.createElement("div");
    row.className = "menu-swatches";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Cor do bloco");
    const current = app.nodeIndex.get(nodeId)?.color ?? "";
    const swatch = (color, className, label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.dataset["color"] = color;
        button.title = label;
        button.setAttribute("aria-label", label);
        if (color)
            button.style.setProperty("--sw", color);
        button.classList.toggle("active", color === current);
        return button;
    };
    row.append(swatch("", "swatch swatch-clear", "Sem cor (vidro transparente)"), ...MENU_SWATCH_COLORS.map((color) => swatch(color, "swatch", color)));
    return row;
}
function openContextMenu(entries, clientX, clientY) {
    contextActions = new Map();
    contextMenu.replaceChildren(...entries.map((entry) => {
        if (entry.kind === "separator") {
            const separator = document.createElement("div");
            separator.className = "menu-sep";
            return separator;
        }
        if (entry.kind === "swatches")
            return contextSwatchRow(entry.nodeId);
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.dataset["action"] = entry.id;
        button.textContent = entry.label;
        if (entry.danger)
            button.classList.add("danger");
        if (entry.disabled)
            button.disabled = true;
        contextActions.set(entry.id, entry.run);
        return button;
    }));
    contextMenu.hidden = false;
    const wrap = canvasWrap.getBoundingClientRect();
    const left = Math.min(wrap.width - contextMenu.offsetWidth - 8, Math.max(8, clientX - wrap.left));
    const top = Math.min(wrap.height - contextMenu.offsetHeight - 8, Math.max(8, clientY - wrap.top));
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.querySelector("button[role=menuitem]:not(:disabled)")?.focus();
}
function nodeContextEntries(id, clientX, clientY) {
    const node = app.nodeIndex.get(id);
    if (!node)
        return [];
    const order = app.file.nodes.findIndex((item) => item.id === id);
    const topmost = order === app.file.nodes.length - 1;
    const bottommost = order === 0;
    return [
        { kind: "action", id: "rename", label: "Renomear", run: openSelectedEditor },
        {
            kind: "action",
            id: "duplicate",
            label: "Duplicar",
            run: () => { app.duplicateNode(id, node.x + 24, node.y + 24); },
        },
        {
            kind: "action",
            id: "connect",
            label: "Conectar a…",
            run: () => {
                app.connectNode(id);
                announce("Modo de conexão: selecione o bloco de destino e pressione C, ou use as portas.");
            },
        },
        { kind: "action", id: "quick", label: "Criar bloco conectado…", run: () => openQuickPicker(id, clientX, clientY) },
        {
            kind: "action",
            id: "loop",
            label: "Conectar a si mesmo (loop)",
            run: () => { app.connectNodes(id, id); },
        },
        { kind: "separator" },
        { kind: "action", id: "front", label: "Trazer para frente", disabled: topmost, run: () => app.reorderNode(id, "front") },
        { kind: "action", id: "forward", label: "Avançar", disabled: topmost, run: () => app.reorderNode(id, "forward") },
        { kind: "action", id: "backward", label: "Recuar", disabled: bottommost, run: () => app.reorderNode(id, "backward") },
        { kind: "action", id: "back", label: "Enviar para trás", disabled: bottommost, run: () => app.reorderNode(id, "back") },
        { kind: "separator" },
        { kind: "swatches", nodeId: id },
        { kind: "action", id: "color-custom", label: "Cor personalizada…", run: () => colorCustom.click() },
        { kind: "separator" },
        {
            kind: "action",
            id: "delete",
            label: "Excluir",
            danger: true,
            run: () => { app.deleteSelection(); announce("Seleção excluída."); },
        },
    ];
}
const EDGE_LINE_OPTIONS = [
    { value: "straight", label: "Linha reta" },
    { value: "ortho", label: "Linha ortogonal" },
    { value: "curved", label: "Linha curva" },
];
function edgeContextEntries(id) {
    const edge = app.file.edges.find((item) => item.id === id);
    const currentLine = edge?.line ?? "straight";
    const hasPoints = (edge?.points?.length ?? 0) > 0;
    return [
        {
            kind: "action",
            id: "rename",
            label: "Renomear rótulo",
            run: () => {
                const target = app.editorTarget({ kind: "edge", id });
                if (target)
                    openEditor(target);
            },
        },
        { kind: "separator" },
        ...EDGE_LINE_OPTIONS.map((option) => ({
            kind: "action",
            id: `line-${option.value}`,
            label: `${option.value === currentLine ? "✓ " : "\u2007\u2007"}${option.label}`,
            run: () => app.setEdgeLine(id, option.value),
        })),
        {
            kind: "action",
            id: "clear-points",
            label: "Remover pontos de passagem",
            disabled: !hasPoints,
            run: () => { app.clearEdgePoints(id); announce("Pontos de passagem removidos."); },
        },
        { kind: "separator" },
        {
            kind: "action",
            id: "delete",
            label: "Excluir conexão",
            danger: true,
            run: () => { app.deleteSelection(); announce("Seleção excluída."); },
        },
    ];
}
function canvasContextEntries(clientX, clientY) {
    return [
        { kind: "action", id: "add", label: "Adicionar bloco…", run: () => openAddPicker(clientX, clientY) },
        { kind: "separator" },
        { kind: "action", id: "fit", label: "Enquadrar diagrama", run: fitView },
        { kind: "action", id: "zoom100", label: "Zoom 100%", run: () => setZoom(1) },
        { kind: "separator" },
        { kind: "action", id: "present", label: "Apresentar", disabled: app.file.nodes.length === 0, run: enterPresentation },
        {
            kind: "action",
            id: "theme",
            label: currentTheme.name === "light" ? "Usar tema escuro" : "Usar tema claro",
            run: () => applyTheme(currentTheme.name === "light" ? "dark" : "light"),
        },
        {
            kind: "action",
            id: "palette",
            label: paletteHidden() ? "Mostrar menu lateral" : "Esconder menu lateral",
            run: () => setPaletteHidden(!paletteHidden()),
        },
        { kind: "action", id: "shortcuts", label: "Atalhos…", run: openShortcuts },
    ];
}
function openShortcuts() {
    shortcutReturnFocus = document.activeElement;
    shortcuts.hidden = false;
    $("#shortcutsTitle").focus();
}
function closeShortcuts() {
    shortcuts.hidden = true;
    shortcutReturnFocus?.focus();
    shortcutReturnFocus = null;
}
async function useSelectedTemplate(insert) {
    if (await app.applyTemplate(templateSelect.value, insert)) {
        renderFull();
        fitView();
    }
}
function firstPaletteDefinition() {
    return cats.querySelector("[data-def]")?.dataset["def"] ?? null;
}
function insertPaletteResult() {
    const definitionId = firstPaletteDefinition();
    if (!definitionId)
        return;
    const selected = app.ui.selection?.kind === "node" ? app.nodeIndex.get(app.ui.selection.id) : null;
    if (selected) {
        const id = app.addConnectedNode(selected.id, definitionId, selected.x + nodeWidth(selected) + 72, selected.y);
        if (id)
            announce("Bloco criado e conectado.");
    }
    else {
        const rect = canvas.getBoundingClientRect();
        addNode(definitionId, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
}
function bindControls() {
    cats.innerHTML = paletteMarkup("", currentTheme);
    cats.addEventListener("click", (event) => {
        const block = event.target.closest("[data-def]");
        if (!block?.dataset["def"])
            return;
        const rect = canvas.getBoundingClientRect();
        addNode(block.dataset["def"], rect.left + rect.width / 2, rect.top + rect.height / 2, (cascade++ % 7) * 24);
    });
    cats.addEventListener("dragstart", (event) => {
        const block = event.target.closest("[data-def]");
        if (!block?.dataset["def"])
            return;
        event.dataTransfer?.setData("text/anatomy-block", block.dataset["def"]);
        if (event.dataTransfer)
            event.dataTransfer.effectAllowed = "copy";
    });
    search.addEventListener("input", () => { cats.innerHTML = paletteMarkup(search.value, currentTheme); });
    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            insertPaletteResult();
        }
    });
    colorPanel.addEventListener("click", (event) => {
        const swatch = event.target.closest("[data-color]");
        const selected = app.ui.selection;
        if (!swatch || selected?.kind !== "node")
            return;
        app.setNodeColor(selected.id, swatch.dataset["color"] || null);
    });
    // Prévia ao vivo enquanto o seletor está aberto; o commit (com histórico)
    // acontece uma única vez no "change".
    colorCustom.addEventListener("input", () => {
        const selected = app.ui.selection;
        if (selected?.kind === "node")
            app.setNodeColor(selected.id, colorCustom.value, "transient");
    });
    colorCustom.addEventListener("change", () => {
        const selected = app.ui.selection;
        if (selected?.kind === "node")
            app.setNodeColor(selected.id, colorCustom.value);
    });
    btnPalette.addEventListener("click", () => setPaletteHidden(!paletteHidden()));
    // Menu de contexto: suprime o nativo dentro do quadro e abre o menu de vidro
    // no cursor — sobre bloco, conexão ou área vazia.
    canvasWrap.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (presentation)
            return;
        closeContextMenu();
        closeQuickPicker();
        closeEditor(false);
        if (!fileMenu.hidden)
            toggleFileMenu(false);
        const target = event.target;
        if (!target.closest("#canvas"))
            return;
        const nodeId = target.closest("[data-node-id]")?.dataset["nodeId"]
            ?? target.closest("[data-port-node]")?.dataset["portNode"]
            ?? target.closest("[data-resize-node]")?.dataset["resizeNode"];
        const edgeId = target.closest("[data-edge-id]")?.dataset["edgeId"];
        if (nodeId && app.nodeIndex.get(nodeId)) {
            app.select({ kind: "node", id: nodeId });
            openContextMenu(nodeContextEntries(nodeId, event.clientX, event.clientY), event.clientX, event.clientY);
        }
        else if (edgeId) {
            app.select({ kind: "edge", id: edgeId });
            openContextMenu(edgeContextEntries(edgeId), event.clientX, event.clientY);
        }
        else {
            openContextMenu(canvasContextEntries(event.clientX, event.clientY), event.clientX, event.clientY);
        }
    });
    contextMenu.addEventListener("click", (event) => {
        const target = event.target;
        const swatch = target.closest("[data-color]");
        if (swatch) {
            const selected = app.ui.selection;
            if (selected?.kind === "node")
                app.setNodeColor(selected.id, swatch.dataset["color"] || null);
            closeContextMenu();
            return;
        }
        const item = target.closest("button[data-action]");
        if (!item?.dataset["action"] || item.hasAttribute("disabled"))
            return;
        const run = contextActions.get(item.dataset["action"]);
        closeContextMenu();
        run?.();
    });
    contextMenu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeContextMenu();
            canvas.focus();
            return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
            return;
        event.preventDefault();
        const items = [...contextMenu.querySelectorAll("button[role=menuitem]:not(:disabled)")];
        if (items.length === 0)
            return;
        const index = items.indexOf(document.activeElement);
        const next = event.key === "ArrowDown"
            ? items[(index + 1) % items.length]
            : items[(index - 1 + items.length) % items.length];
        next?.focus();
    });
    fileMenuButton.addEventListener("click", () => toggleFileMenu());
    fileMenu.addEventListener("click", (event) => {
        if (event.target.closest("button[role=menuitem]"))
            toggleFileMenu(false);
    });
    document.addEventListener("pointerdown", (event) => {
        if (!fileMenu.hidden && !event.target.closest(".file-menu"))
            toggleFileMenu(false);
        if (!contextMenu.hidden && !event.target.closest("#contextMenu"))
            closeContextMenu();
    });
    canvas.addEventListener("pointerdown", (event) => {
        if (presentation)
            return;
        // Botão direito fica com o menu de contexto — não inicia pan nem desseleciona.
        if (event.button === 2)
            return;
        if (activePointerId !== null && event.pointerId !== activePointerId)
            return;
        const target = event.target;
        const handle = target.closest("[data-resize-node]");
        const port = target.closest("[data-port-node]");
        const node = target.closest("[data-node-id]");
        const edge = target.closest("[data-edge-id]");
        const edgePointHandle = target.closest("[data-edge-point]");
        if (handle?.dataset["resizeNode"] && handle.dataset["resizeCorner"] && event.button === 0) {
            const id = handle.dataset["resizeNode"];
            const item = app.nodeIndex.get(id);
            if (!item)
                return;
            beginGesture();
            app.select({ kind: "node", id });
            resizing = {
                id,
                corner: handle.dataset["resizeCorner"],
                x: item.x,
                y: item.y,
                w: nodeWidth(item),
                h: nodeHeight(item),
            };
        }
        else if (edgePointHandle?.dataset["edgePoint"] && event.button === 0) {
            const id = edgePointHandle.dataset["edgePoint"];
            const index = Number(edgePointHandle.dataset["pointIndex"]);
            if (!Number.isInteger(index))
                return;
            beginGesture();
            app.select({ kind: "edge", id });
            const targetPoint = point(event.clientX, event.clientY);
            edgeDrag = { id, x: targetPoint.x, y: targetPoint.y, index };
        }
        else if (port?.dataset["portNode"] && event.button === 0) {
            beginGesture();
            const fromSide = (port.dataset["portSide"] ?? null);
            portDrag = { from: port.dataset["portNode"], fromSide, moved: false };
            app.select({ kind: "node", id: port.dataset["portNode"] });
            app.connectNode(port.dataset["portNode"]);
        }
        else if (node && event.button === 0) {
            let id = node.dataset["nodeId"];
            let item = app.nodeIndex.get(id);
            if (!item)
                return;
            if (event.altKey) {
                const duplicate = app.duplicateNode(id, item.x, item.y);
                if (duplicate) {
                    id = duplicate;
                    item = app.nodeIndex.get(id);
                }
            }
            if (!item)
                return;
            beginGesture();
            const targetPoint = point(event.clientX, event.clientY);
            app.select({ kind: "node", id });
            drag = { id, dx: targetPoint.x - item.x, dy: targetPoint.y - item.y };
        }
        else if (edge && event.button === 0) {
            const id = edge.dataset["edgeId"];
            beginGesture();
            app.select({ kind: "edge", id });
            // Arrastar a linha cria um waypoint naquele ponto (estilo draw.io);
            // um clique simples continua apenas selecionando.
            const targetPoint = point(event.clientX, event.clientY);
            edgeDrag = { id, x: targetPoint.x, y: targetPoint.y, index: null };
        }
        else {
            beginGesture();
            panning = { sx: event.clientX, sy: event.clientY, x: viewport.x, y: viewport.y };
            app.select(null);
        }
        activePointerId = event.pointerId;
        try {
            canvas.setPointerCapture(event.pointerId);
        }
        catch { /* synthetic pointer */ }
    });
    canvas.addEventListener("pointermove", (event) => {
        if (presentation && activePointerId === null) {
            laser = point(event.clientX, event.clientY);
            renderer.renderOverlay(displayedDiagram(), visualState(), currentTheme);
            return;
        }
        if (!presentation && activePointerId === null)
            updateHoverPorts(event.target);
        if (activePointerId !== null && event.pointerId !== activePointerId)
            return;
        if (drag || resizing || portDrag || edgeDrag)
            pointerMoves.schedule({ x: event.clientX, y: event.clientY, free: event.altKey });
        else if (panning) {
            viewport = { ...viewport, x: panning.x + event.clientX - panning.sx, y: panning.y + event.clientY - panning.sy };
            applyViewport();
        }
    });
    canvas.addEventListener("pointerleave", () => {
        if (!presentation || !laser)
            return;
        laser = null;
        renderer.renderOverlay(displayedDiagram(), visualState(), currentTheme);
    });
    canvas.addEventListener("pointerup", finishPointerGesture);
    canvas.addEventListener("pointercancel", finishPointerGesture);
    canvas.addEventListener("lostpointercapture", finishPointerGesture);
    canvas.addEventListener("click", (event) => {
        const template = event.target.closest("[data-template-id]");
        if (template?.dataset["templateId"]) {
            templateSelect.value = template.dataset["templateId"];
            void useSelectedTemplate(false);
        }
    });
    canvas.addEventListener("focus", (event) => {
        const nodeId = focusedNodeId(event.target);
        if (nodeId && app.ui.selection?.id !== nodeId) {
            app.select({ kind: "node", id: nodeId });
        }
    }, true);
    canvas.addEventListener("keydown", (event) => {
        const port = event.target.closest("[data-port-node]");
        const template = event.target.closest("[data-template-id]");
        if ((event.key === "Enter" || event.key === " ") && port?.dataset["portNode"]) {
            event.preventDefault();
            openQuickPicker(port.dataset["portNode"]);
        }
        else if ((event.key === "Enter" || event.key === " ") && template?.dataset["templateId"]) {
            event.preventDefault();
            templateSelect.value = template.dataset["templateId"];
            void useSelectedTemplate(false);
        }
        else if (event.target.closest("[data-node-id]") && event.key === "Enter") {
            openSelectedEditor();
        }
    });
    canvas.addEventListener("dblclick", (event) => {
        const pointHandle = event.target.closest("[data-edge-point]");
        if (pointHandle?.dataset["edgePoint"]) {
            const index = Number(pointHandle.dataset["pointIndex"]);
            if (Number.isInteger(index)) {
                app.removeEdgePoint(pointHandle.dataset["edgePoint"], index);
                announce("Ponto de passagem removido.");
            }
            return;
        }
        const element = event.target.closest("[data-node-id],[data-edge-id]");
        const target = element?.dataset["nodeId"]
            ? app.editorTarget({ kind: "node", id: element.dataset["nodeId"] })
            : element?.dataset["edgeId"]
                ? app.editorTarget({ kind: "edge", id: element.dataset["edgeId"] })
                : null;
        if (target)
            openEditor(target);
    });
    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        closeContextMenu();
        refreshGesture();
        const rect = gestureRect ?? canvas.getBoundingClientRect();
        viewport = zoomAround(viewport, viewport.zoom * Math.exp(-event.deltaY * .0012), event.clientX, event.clientY, rect);
        applyViewport();
    }, { passive: false });
    canvas.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes("text/anatomy-block"))
            event.preventDefault();
    });
    canvas.addEventListener("drop", (event) => {
        const definitionId = event.dataTransfer?.getData("text/anatomy-block");
        if (definitionId) {
            event.preventDefault();
            addNode(definitionId, event.clientX, event.clientY);
        }
    });
    labelEditor.addEventListener("keydown", (event) => {
        if (event.key === "Enter")
            closeEditor(true);
        if (event.key === "Escape")
            closeEditor(false);
        event.stopPropagation();
    });
    labelEditor.addEventListener("blur", () => closeEditor(true));
    quickSearch.addEventListener("input", () => renderQuickResults(quickSearch.value));
    quickSearch.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            const first = quickResults.querySelector("[data-def]");
            if (first?.dataset["def"])
                quickCreate(first.dataset["def"]);
        }
        else if (event.key === "Escape")
            closeQuickPicker();
    });
    quickResults.addEventListener("click", (event) => {
        const block = event.target.closest("[data-def]");
        if (block?.dataset["def"])
            quickCreate(block.dataset["def"]);
    });
    document.addEventListener("keydown", (event) => {
        if (presentation) {
            if (event.key === "Escape") {
                event.preventDefault();
                exitPresentation();
            }
            else if (event.key === "ArrowRight") {
                event.preventDefault();
                revealPresentation(1);
            }
            else if (event.key === "ArrowLeft") {
                event.preventDefault();
                revealPresentation(-1);
            }
            return;
        }
        if (isTextEntryTarget(event.target))
            return;
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (modifier && key === "z" && !event.shiftKey) {
            event.preventDefault();
            app.undo();
        }
        else if ((modifier && key === "y") || (modifier && event.shiftKey && key === "z")) {
            event.preventDefault();
            app.redo();
        }
        else if (modifier && event.key === "Enter") {
            event.preventDefault();
            const selected = app.ui.selection?.kind === "node" ? app.nodeIndex.get(app.ui.selection.id) : null;
            if (selected) {
                const id = app.addConnectedNode(selected.id, "api", selected.x + nodeWidth(selected) + 72, selected.y);
                if (id)
                    openEditor(app.editorTarget({ kind: "node", id }));
            }
        }
        else if (modifier && key === "d") {
            event.preventDefault();
            const selected = app.ui.selection?.kind === "node" ? app.nodeIndex.get(app.ui.selection.id) : null;
            if (selected)
                app.duplicateNode(selected.id, selected.x + 24, selected.y + 24);
        }
        else if (modifier && event.key === ".") {
            event.preventDefault();
            document.body.classList.toggle("chrome-collapsed");
            refreshGesture();
        }
        else if (event.key === "Delete" || event.key === "Backspace") {
            app.deleteSelection();
            announce("Seleção excluída.");
        }
        else if (event.key === "Escape") {
            if (!contextMenu.hidden)
                closeContextMenu();
            else if (!shortcuts.hidden)
                closeShortcuts();
            else if (!fileMenu.hidden)
                toggleFileMenu(false);
            else {
                closeQuickPicker();
                app.cancelConnection();
                app.select(null);
            }
        }
        else if (event.key === "/" && !modifier) {
            event.preventDefault();
            search.focus();
        }
        else if (event.key === "?") {
            event.preventDefault();
            openShortcuts();
        }
        else if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            openSelectedEditor();
        }
        else if (key === "c" && !modifier) {
            const selected = app.ui.selection?.kind === "node" ? app.ui.selection.id : null;
            if (selected)
                app.connectNode(selected);
        }
    });
    $("#btnTheme").addEventListener("click", () => {
        applyTheme(currentTheme.name === "light" ? "dark" : "light");
    });
    $("#btnPresent").addEventListener("click", enterPresentation);
    $("#btnUndo").addEventListener("click", () => app.undo());
    $("#btnRedo").addEventListener("click", () => app.redo());
    $("#btnZoomIn").addEventListener("click", () => setZoom(viewport.zoom * 1.2));
    $("#btnZoomOut").addEventListener("click", () => setZoom(viewport.zoom / 1.2));
    $("#btnZoomReset").addEventListener("click", () => setZoom(1));
    $("#btnFit").addEventListener("click", fitView);
    $("#btnCloseShortcuts").addEventListener("click", closeShortcuts);
    bindBrowserExports({ png: $("#btnPng"), svg: $("#btnSvg"), json: $("#btnSave") }, { diagram: () => app.file, file: () => app.exportFile() }, status.reportExport);
    $("#btnOpen").addEventListener("click", () => fileInput.click());
    $("#btnNewDocument").addEventListener("click", () => { if (app.createDocument()) {
        renderFull();
        fitView();
    } });
    $("#btnNewFromTemplate").addEventListener("click", () => void useSelectedTemplate(false));
    $("#btnInsertTemplate").addEventListener("click", () => void useSelectedTemplate(true));
    $("#btnDeleteDocument").addEventListener("click", () => {
        if (confirm(`Excluir "${app.file.meta.title}"?`)) {
            app.deleteCurrentDocument();
            renderFull();
            fitView();
        }
    });
    $("#btnClear").addEventListener("click", () => {
        if (app.file.nodes.length && confirm("Apagar o diagrama inteiro?"))
            app.clear();
    });
    documentSelect.addEventListener("change", () => {
        if (app.switchDocument(documentSelect.value)) {
            cascade = 0;
            renderFull();
            fitView();
        }
    });
    documentTitle.addEventListener("change", () => { app.setTitle(documentTitle.value); refreshDocuments(); });
    documentTitle.addEventListener("keydown", (event) => { if (event.key === "Enter")
        documentTitle.blur(); });
    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file)
            void readDiagramFile(file).then((imported) => {
                if (imported.ok && app.createDocument(imported.file)) {
                    renderFull();
                    fitView();
                    status.show("Arquivo importado.");
                }
                else
                    status.show(imported.message ?? "Não foi possível importar o arquivo.", true);
            });
        fileInput.value = "";
    });
}
async function initializeBrowser() {
    app.initialize();
    if (!app.ready) {
        status.show("Não foi possível inicializar o editor.", true);
        return;
    }
    bindControls();
    setPaletteHidden(storedPaletteHidden(), false);
    applyTheme(currentTheme.name, false);
    hint.textContent = "Arraste blocos · use portas para conectar · Enter renomeia · ? mostra atalhos";
    await app.installCourseDocuments();
    refreshDocuments();
    renderFull();
    fitView();
    document.body.setAttribute("aria-busy", "false");
    bindBrowserLifecycle({
        flush: () => { app.flush(); },
        refreshLayout: refreshGesture,
        externalDocument: (documentId) => app.handleExternalStorageChange(documentId),
        reloadDocument: () => { renderFull(); fitView(); },
        status,
    });
}
void initializeBrowser();
