import { CATEGORIAS, ESSENTIAL_BLOCK_IDS, resolveDef } from "./catalog.js";
import { anchorOnRect, diagramBounds, edgeRoute, nodeHeight, nodeWidth, polylineMidpoint, NODE_HEIGHT, NODE_WIDTH, wrapLabel, } from "./geometry.js";
import { CATEGORY_GLYPHS, glyphMarkup, glyphSvg } from "./icons.js";
import { LIGHT_THEME } from "./theme.js";
export { NODE_HEIGHT, NODE_WIDTH } from "./geometry.js";
const NODE_RADIUS = 26;
export const RESIZE_HANDLE_SIZE = 10;
/** Definição do bloco de texto livre (renderizado sem glifo, só o rótulo). */
export const TEXT_BLOCK_DEF = "texto";
const FONT = `system-ui, -apple-system, 'Segoe UI', sans-serif`;
export function escapeXml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
/** Retângulo de cantos contínuos (aproximação de squircle, estilo iOS). */
function squirclePath(x, y, w, h, r) {
    const k = r * 0.448; // handle curto = curvatura que "entra" suave na reta
    const x2 = x + w;
    const y2 = y + h;
    return [
        `M ${x + r} ${y}`,
        `L ${x2 - r} ${y}`,
        `C ${x2 - k} ${y} ${x2} ${y + k} ${x2} ${y + r}`,
        `L ${x2} ${y2 - r}`,
        `C ${x2} ${y2 - k} ${x2 - k} ${y2} ${x2 - r} ${y2}`,
        `L ${x + r} ${y2}`,
        `C ${x + k} ${y2} ${x} ${y2 - k} ${x} ${y2 - r}`,
        `L ${x} ${y + r}`,
        `C ${x} ${y + k} ${x + k} ${y} ${x + r} ${y}`,
        "Z",
    ].join(" ");
}
const NODE_SQUIRCLE = squirclePath(0, 0, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS);
const NODE_SQUIRCLE_INSET = squirclePath(2, 2, NODE_WIDTH - 4, NODE_HEIGHT - 4, NODE_RADIUS - 2);
function nodeRadius(w, h) {
    return Math.min(NODE_RADIUS, w / 2, h / 2);
}
function nodeSquircle(x, y, w, h) {
    return squirclePath(x, y, w, h, nodeRadius(w, h));
}
/** Id seguro para defs por nó (os IDs do modelo já são [A-Za-z0-9_-]). */
function defsSafeId(value) {
    return value.replaceAll(/[^A-Za-z0-9_-]/g, "");
}
/** Luminância percebida (0-255) de uma cor #RRGGBB para contraste do texto. */
function hexLuminance(hex) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b))
        return 0;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
function arrowTriangle(sx, sy, ex, ey, size = 9) {
    const angle = Math.atan2(ey - sy, ex - sx);
    const left = angle + Math.PI - 0.44;
    const right = angle + Math.PI + 0.44;
    const lx = ex + Math.cos(left) * size;
    const ly = ey + Math.sin(left) * size;
    const rx = ex + Math.cos(right) * size;
    const ry = ey + Math.sin(right) * size;
    return `M ${ex.toFixed(1)} ${ey.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;
}
/**
 * Defs compartilhados do material de vidro dos nós: sheen vertical, specular,
 * rim iluminado por cima, brilho interno e sombra em duas camadas.
 * Viajam junto no export — o arquivo SVG é autossuficiente.
 */
function glassDefs(theme) {
    const dark = theme.name === "dark";
    const sheenTop = dark ? 0.18 : 0.45;
    const sheenBottom = dark ? 0.07 : 0.16;
    const spec = dark ? 0.4 : 0.85;
    const rimTop = dark ? 0.55 : 0.95;
    const rimMid = dark ? 0.12 : 0.28;
    const rimBottom = dark ? 0.26 : 0.6;
    const shadowAlpha = dark ? 0.5 : 0.26;
    const depth = dark ? 0.26 : 0.1;
    const caustic = dark ? 0.3 : 0.6;
    return `<defs>
    <clipPath id="lgn-clip"><path d="${NODE_SQUIRCLE}"/></clipPath>
    <linearGradient id="lgn-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${sheenTop}"/>
      <stop offset=".3" stop-color="#FFFFFF" stop-opacity="${dark ? 0.03 : 0.07}"/>
      <stop offset=".82" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="${sheenBottom}"/>
    </linearGradient>
    <radialGradient id="lgn-spec" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${spec}"/>
      <stop offset=".62" stop-color="#FFFFFF" stop-opacity="${dark ? 0.1 : 0.22}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lgn-depth" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".78" stop-color="#10101C" stop-opacity="0"/>
      <stop offset="1" stop-color="#10101C" stop-opacity="${depth}"/>
    </linearGradient>
    <linearGradient id="lgn-caustic" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".8" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="${caustic}"/>
    </linearGradient>
    <linearGradient id="lgn-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${rimTop}"/>
      <stop offset=".5" stop-color="#FFFFFF" stop-opacity="${rimMid}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="${rimBottom}"/>
    </linearGradient>
    <filter id="lgn-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
    <filter id="lgn-shadow" x="-40%" y="-60%" width="180%" height="260%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#10102C" flood-opacity="${shadowAlpha}"/>
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#10102C" flood-opacity="${dark ? 0.45 : 0.22}"/>
    </filter>
    <filter id="lgn-glyph" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#10101C" flood-opacity=".35"/>
    </filter>
  </defs>`;
}
function blockMarkup(blockId, theme) {
    const resolved = resolveDef(blockId);
    if (!resolved)
        return "";
    const colors = theme.categories[resolved.cat.themeKey];
    const block = resolved.def;
    return `<button type="button" class="block-item" draggable="true" title="${escapeXml(block.desc)}" data-def="${escapeXml(block.id)}" data-search="${escapeXml(`${block.nome} ${block.desc} ${resolved.cat.nome}`.toLowerCase())}" style="--cat-fill:${colors.fill};--cat-stroke:${colors.stroke};--cat-ink:${colors.ink}">${glyphSvg(block.id, 22, "bi")}<span class="bn">${escapeXml(block.nome)}</span></button>`;
}
export function paletteMarkup(query = "", theme = LIGHT_THEME) {
    const normalizedQuery = query.trim().toLowerCase();
    const essentials = ESSENTIAL_BLOCK_IDS
        .filter((id) => {
        const resolved = resolveDef(id);
        return resolved && `${resolved.def.nome} ${resolved.def.desc} ${resolved.cat.nome}`.toLowerCase().includes(normalizedQuery);
    })
        .map((id) => blockMarkup(id, theme))
        .join("");
    const essentialGroup = essentials
        ? `<details open data-cat="essenciais"><summary>Essenciais <span class="count">${ESSENTIAL_BLOCK_IDS.length}</span></summary><div class="blocks">${essentials}</div></details>`
        : "";
    const categories = CATEGORIAS.map((category) => {
        const visibleBlocks = category.blocos.filter((block) => `${block.nome} ${block.desc} ${category.nome}`.toLowerCase().includes(normalizedQuery));
        if (visibleBlocks.length === 0)
            return "";
        const blocks = visibleBlocks.map((block) => blockMarkup(block.id, theme)).join("");
        return `<details${normalizedQuery ? " open" : ""} data-cat="${escapeXml(category.id)}"><summary>${glyphSvg(CATEGORY_GLYPHS[category.themeKey] ?? "", 18, "cat-icon")} ${escapeXml(category.nome)} <span class="count">${category.blocos.length}</span></summary><div class="blocks">${blocks}</div></details>`;
    }).join("");
    return essentialGroup + categories;
}
const DEFAULT_NODE_AREA = NODE_WIDTH * NODE_HEIGHT;
/** Caixa grande (ex.: servidor) fica atrás dos serviços que ela envolve. */
export function isBackdropNode(node) {
    return nodeWidth(node) * nodeHeight(node) >= DEFAULT_NODE_AREA * 2.2;
}
export function nodeMarkup(node, theme = LIGHT_THEME) {
    const resolved = resolveDef(node.def);
    const colors = resolved ? theme.categories[resolved.cat.themeKey] : null;
    const dark = theme.name === "dark";
    const w = nodeWidth(node);
    const h = nodeHeight(node);
    const backdrop = isBackdropNode(node);
    const defaultSize = w === NODE_WIDTH && h === NODE_HEIGHT;
    const squircle = defaultSize ? NODE_SQUIRCLE : nodeSquircle(0, 0, w, h);
    const inset = defaultSize
        ? NODE_SQUIRCLE_INSET
        : squirclePath(2, 2, w - 4, h - 4, Math.max(0, nodeRadius(w, h) - 2));
    const clipId = defaultSize ? "lgn-clip" : `lgn-clip-${defsSafeId(node.id)}`;
    const clipDef = defaultSize ? "" : `<clipPath id="${clipId}"><path d="${squircle}"/></clipPath>`;
    const lines = wrapLabel(node.label);
    const labelYs = lines.length > 1 ? [h - 32, h - 16] : [h - 26];
    // Vidro estilo iOS 26: por padrão o bloco é vidro TRANSPARENTE (tint neutro
    // quase nulo, glifo na cor da categoria). Se o usuário escolheu uma cor na
    // grade, ela tinge o vidro (translúcido) e o texto/glifo ganha contraste
    // automático pela luminância da cor.
    let base;
    let baseOpacity;
    let glyphColor;
    let labelColor;
    if (node.color) {
        base = node.color;
        baseOpacity = dark ? 0.58 : 0.62;
        const ink = hexLuminance(node.color) > 168 ? "#1F1E1B" : "#FFFFFF";
        glyphColor = ink;
        labelColor = ink;
    }
    else {
        base = dark ? "#EAF0FF" : "#F6F4EE";
        baseOpacity = backdrop ? (dark ? 0.08 : 0.2) : dark ? 0.13 : 0.36;
        glyphColor = colors ? colors.stroke : theme.inkMuted;
        labelColor = theme.ink;
    }
    let content;
    if (node.def === TEXT_BLOCK_DEF) {
        // Bloco de texto: sem glifo; o rótulo vira parágrafo quebrado conforme o
        // tamanho do nó, centralizado verticalmente.
        const maxChars = Math.max(4, Math.floor((w - 28) / 7.4));
        const maxLines = Math.max(1, Math.floor((h - 24) / 18));
        const textLines = wrapLabel(node.label, maxChars, maxLines);
        content = textLines
            .map((line, index) => `<text x="${w / 2}" y="${h / 2 + (index - (textLines.length - 1) / 2) * 18}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="13" font-weight="500" fill="${labelColor}">${escapeXml(line)}</text>`)
            .join("");
        content = `<g filter="url(#lgn-glyph)">${content}</g>`;
    }
    else {
        const labelTexts = lines
            .map((line, index) => `<text x="${w / 2}" y="${labelYs[index]}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="600" fill="${labelColor}">${escapeXml(line)}</text>`)
            .join("");
        content = `<g filter="url(#lgn-glyph)">${glyphMarkup(node.def, (w - 36) / 2, 12, 36, glyphColor)}</g>
    <g filter="url(#lgn-glyph)">${labelTexts}</g>`;
    }
    const glow = dark ? 0.28 : 0.65;
    return `<g data-node-id="${escapeXml(node.id)}" class="dnode" transform="translate(${node.x} ${node.y})" tabindex="0" role="group" aria-label="${escapeXml(`${resolved?.def.nome ?? "Bloco desconhecido"}: ${node.label}`)}">${clipDef}
    <path d="${squircle}" fill="${base}" fill-opacity="${baseOpacity}" filter="url(#lgn-shadow)"/>
    <g clip-path="url(#${clipId})">
      <path d="${squircle}" fill="url(#lgn-depth)"/>
      <path d="${squircle}" fill="url(#lgn-sheen)"/>
      <ellipse cx="${w * 0.32}" cy="9" rx="${w * 0.3}" ry="10" fill="url(#lgn-spec)"/>
      <path d="${inset}" fill="none" stroke="#FFFFFF" stroke-opacity="${glow}" stroke-width="3" filter="url(#lgn-soft)"/>
      <path d="${inset}" fill="none" stroke="url(#lgn-caustic)" stroke-width="2"/>
    </g>
    <path d="${squircle}" fill="none" stroke="url(#lgn-rim)" stroke-width="1.6"/>
    ${content}
  </g>`;
}
function fmt(value) {
    return value.toFixed(1);
}
function polyPathD(pts) {
    return pts.map((pt, index) => `${index === 0 ? "M" : "L"} ${fmt(pt.x)} ${fmt(pt.y)}`).join(" ");
}
/** Polilinha ortogonal com cantos arredondados (estilo draw.io "rounded"). */
function orthoPathD(pts, radius = 9) {
    if (pts.length < 3)
        return polyPathD(pts);
    const parts = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`];
    for (let index = 1; index < pts.length - 1; index += 1) {
        const prev = pts[index - 1];
        const corner = pts[index];
        const next = pts[index + 1];
        const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
        const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
        const r = Math.min(radius, inLength / 2, outLength / 2);
        if (r < 1 || inLength === 0 || outLength === 0) {
            parts.push(`L ${fmt(corner.x)} ${fmt(corner.y)}`);
            continue;
        }
        const inPoint = {
            x: corner.x - ((corner.x - prev.x) / inLength) * r,
            y: corner.y - ((corner.y - prev.y) / inLength) * r,
        };
        const outPoint = {
            x: corner.x + ((next.x - corner.x) / outLength) * r,
            y: corner.y + ((next.y - corner.y) / outLength) * r,
        };
        parts.push(`L ${fmt(inPoint.x)} ${fmt(inPoint.y)}`, `Q ${fmt(corner.x)} ${fmt(corner.y)} ${fmt(outPoint.x)} ${fmt(outPoint.y)}`);
    }
    const last = pts[pts.length - 1];
    parts.push(`L ${fmt(last.x)} ${fmt(last.y)}`);
    return parts.join(" ");
}
/** Curva suave: bow quadrático quando só há âncoras; Catmull-Rom com waypoints. */
function curvePathD(pts) {
    if (pts.length === 2) {
        const [a, b] = [pts[0], pts[1]];
        const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const bow = Math.min(48, Math.max(18, distance * 0.16));
        const control = {
            x: (a.x + b.x) / 2 + ((b.y - a.y) / distance) * bow,
            y: (a.y + b.y) / 2 - ((b.x - a.x) / distance) * bow,
        };
        return {
            d: `M ${fmt(a.x)} ${fmt(a.y)} Q ${fmt(control.x)} ${fmt(control.y)} ${fmt(b.x)} ${fmt(b.y)}`,
            tangent: control,
            mid: { x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y },
        };
    }
    const parts = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`];
    for (let index = 0; index < pts.length - 1; index += 1) {
        const p0 = pts[Math.max(0, index - 1)];
        const p1 = pts[index];
        const p2 = pts[index + 1];
        const p3 = pts[Math.min(pts.length - 1, index + 2)];
        const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
        const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
        parts.push(`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`);
    }
    return { d: parts.join(" "), tangent: pts[pts.length - 2], mid: polylineMidpoint(pts) };
}
/** Constrói os paths SVG de uma rota; compartilhado entre documento e overlay. */
export function edgeVisual(route) {
    const pts = route.pts;
    const end = pts[pts.length - 1];
    if (route.style === "curved") {
        const curve = curvePathD(pts);
        return {
            dHit: curve.d,
            dLine: curve.d,
            arrow: arrowTriangle(curve.tangent.x, curve.tangent.y, end.x, end.y),
            mid: curve.mid,
        };
    }
    const prev = pts.length > 1 ? pts[pts.length - 2] : end;
    const length = Math.hypot(end.x - prev.x, end.y - prev.y);
    const trim = Math.min(5, length / 2);
    const lineEnd = length > 0
        ? { x: end.x - ((end.x - prev.x) / length) * trim, y: end.y - ((end.y - prev.y) / length) * trim }
        : end;
    const linePts = [...pts.slice(0, -1), lineEnd];
    const d = route.style === "ortho" ? orthoPathD(pts) : polyPathD(pts);
    const dLine = route.style === "ortho" ? orthoPathD(linePts) : polyPathD(linePts);
    return {
        dHit: d,
        dLine,
        arrow: arrowTriangle(prev.x, prev.y, end.x, end.y),
        mid: polylineMidpoint(pts),
    };
}
export function edgeMarkup(edge, nodeIndex, theme = LIGHT_THEME, allEdges = []) {
    const route = edgeRoute(edge, nodeIndex, allEdges);
    if (!route)
        return "";
    const visual = edgeVisual(route);
    const label = edge.label
        ? `<text x="${fmt(visual.mid.x)}" y="${fmt(visual.mid.y - 8)}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${theme.inkMuted}" stroke="${theme.canvas}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${escapeXml(edge.label)}</text>`
        : "";
    return `<g data-edge-id="${escapeXml(edge.id)}" class="dedge">
    <path d="${visual.dHit}" fill="none" stroke="transparent" stroke-width="16"/>
    <path d="${visual.dLine}" fill="none" stroke="${theme.edge}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="${visual.arrow}" fill="${theme.edge}"/>
    ${label}
  </g>`;
}
export function documentMarkup(diagram, theme = LIGHT_THEME) {
    const nodeIndex = new Map(diagram.nodes.map((node) => [node.id, node]));
    const edges = diagram.edges.map((edge) => edgeMarkup(edge, nodeIndex, theme, diagram.edges)).join("");
    const backdrop = diagram.nodes.filter((node) => isBackdropNode(node));
    const foreground = diagram.nodes.filter((node) => !isBackdropNode(node));
    return glassDefs(theme)
        + backdrop.map((node) => nodeMarkup(node, theme)).join("")
        + edges
        + foreground.map((node) => nodeMarkup(node, theme)).join("");
}
export function presentationDiagram(diagram, revealedCount) {
    const nodes = diagram.nodes.slice(0, Math.max(0, Math.min(diagram.nodes.length, revealedCount)));
    const visible = new Set(nodes.map(({ id }) => id));
    return {
        nodes,
        edges: diagram.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)),
    };
}
export function interactionMarkup(diagram, visualState, theme = LIGHT_THEME) {
    if (visualState.presentation)
        return "";
    // Canvas vazio fica vazio de verdade: os modelos de aula vivem no menu Arquivo.
    if (diagram.nodes.length === 0)
        return "";
    const selectedId = visualState.selection?.kind === "node" ? visualState.selection.id : "";
    const ports = diagram.nodes.map((node) => {
        const selected = node.id === selectedId ? " selected" : "";
        const w = nodeWidth(node);
        const h = nodeHeight(node);
        const positions = [
            ["top", w / 2, 0],
            ["right", w, h / 2],
            ["bottom", w / 2, h],
            ["left", 0, h / 2],
        ];
        const corners = [
            ["nw", 0, 0],
            ["ne", w, 0],
            ["se", w, h],
            ["sw", 0, h],
        ];
        const half = RESIZE_HANDLE_SIZE / 2;
        const handles = selected
            ? corners.map(([corner, x, y]) => `<rect class="resize-handle resize-${corner}" data-resize-node="${escapeXml(node.id)}" data-resize-corner="${corner}" x="${x - half}" y="${y - half}" width="${RESIZE_HANDLE_SIZE}" height="${RESIZE_HANDLE_SIZE}" rx="3" aria-label="Redimensionar ${escapeXml(node.label)}" fill="${theme.surface}" stroke="${theme.accent}" stroke-width="2"/>`).join("")
            : "";
        return `<g class="node-ports${selected}" data-ports-for="${escapeXml(node.id)}" transform="translate(${node.x} ${node.y})">${positions.map(([side, x, y]) => `<circle class="port" data-port-node="${escapeXml(node.id)}" data-port-side="${side}" cx="${x}" cy="${y}" r="7" tabindex="${selected ? "0" : "-1"}" role="button" aria-label="Conectar ${side} de ${escapeXml(node.label)}" fill="${theme.surface}" stroke="${theme.accent}" stroke-width="2"/>`).join("")}${handles}</g>`;
    }).join("");
    const guides = (visualState.guides ?? []).map((guide) => guide.axis === "x"
        ? `<line class="alignment-guide" x1="${guide.position}" y1="${guide.from}" x2="${guide.position}" y2="${guide.to}" stroke="${theme.accent}"/>`
        : `<line class="alignment-guide" x1="${guide.from}" y1="${guide.position}" x2="${guide.to}" y2="${guide.position}" stroke="${theme.accent}"/>`).join("");
    // Alças de waypoint da conexão selecionada: arrastar ajusta o trajeto,
    // duplo clique remove o ponto.
    const selectedEdge = visualState.selection?.kind === "edge"
        ? diagram.edges.find((edge) => edge.id === visualState.selection?.id)
        : undefined;
    const edgeHandles = selectedEdge?.points?.length
        ? `<g class="edge-points">${selectedEdge.points.map((pt, index) => `<circle class="edge-point" data-edge-point="${escapeXml(selectedEdge.id)}" data-point-index="${index}" cx="${pt.x}" cy="${pt.y}" r="6.5" tabindex="0" role="button" aria-label="Ponto de passagem ${index + 1}" fill="${theme.surface}" stroke="${theme.accent}" stroke-width="2"/>`).join("")}</g>`
        : "";
    return ports + `<g class="alignment-guides">${guides}</g>` + edgeHandles;
}
export function overlayMarkup(diagram, visualState, theme = LIGHT_THEME) {
    const nodeIndex = new Map(diagram.nodes.map((node) => [node.id, node]));
    const selectedNode = visualState.selection?.kind === "node" ? nodeIndex.get(visualState.selection.id) : undefined;
    const selectedEdge = visualState.selection?.kind === "edge"
        ? diagram.edges.find((edge) => edge.id === visualState.selection?.id)
        : undefined;
    let selection = "";
    if (selectedNode) {
        const w = nodeWidth(selectedNode);
        const h = nodeHeight(selectedNode);
        selection = `<path class="selection-outline" d="${squirclePath(selectedNode.x - 6, selectedNode.y - 6, w + 12, h + 12, nodeRadius(w, h) + 5)}" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-opacity=".9"/>`;
    }
    else if (selectedEdge) {
        const route = edgeRoute(selectedEdge, nodeIndex, diagram.edges);
        if (route) {
            const visual = edgeVisual(route);
            selection = `<path class="selection-outline" d="${visual.dLine}" fill="none" stroke="${theme.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="${visual.arrow}" fill="${theme.accent}"/>`;
        }
    }
    const source = visualState.connectFrom ? nodeIndex.get(visualState.connectFrom) : undefined;
    const sourceHighlight = source
        ? `<path class="connection-source" d="${squirclePath(source.x - 6, source.y - 6, nodeWidth(source) + 12, nodeHeight(source) + 12, nodeRadius(nodeWidth(source), nodeHeight(source)) + 5)}" fill="none" stroke="${theme.accent}" stroke-width="2.4" stroke-opacity=".95"/>`
        : "";
    let preview = "";
    if (source && visualState.connectCursor) {
        const start = anchorOnRect(source, visualState.connectCursor.x, visualState.connectCursor.y);
        preview = `<path class="connection-preview" d="M ${start.x} ${start.y} L ${visualState.connectCursor.x} ${visualState.connectCursor.y}" fill="none" stroke="${theme.accent}" stroke-width="1.8" stroke-dasharray="7 6" stroke-linecap="round"/>`;
    }
    const laser = visualState.laser
        ? `<circle class="laser-pointer" cx="${visualState.laser.x}" cy="${visualState.laser.y}" r="6"/>`
        : "";
    return selection + sourceHighlight + preview + laser;
}
export function buildExportSvg(diagram) {
    const bounds = diagramBounds(diagram, 48);
    if (!bounds)
        return null;
    const w = Math.round(bounds.width);
    const h = Math.round(bounds.height);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bounds.minX} ${bounds.minY} ${w} ${h}"><rect x="${bounds.minX}" y="${bounds.minY}" width="${w}" height="${h}" fill="${LIGHT_THEME.exportBackground}"/>${documentMarkup(diagram, LIGHT_THEME)}</svg>`;
    return { svg, w, h };
}
