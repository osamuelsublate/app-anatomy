import { documentMarkup, edgeMarkup, interactionMarkup, overlayMarkup } from "./markup.js";
import { LIGHT_THEME } from "./theme.js";
function cssEscape(value) {
    const escape = globalThis.CSS?.escape;
    return escape ? escape(value) : value.replaceAll(/[^A-Za-z0-9_-]/g, "\\$&");
}
export function createCanvasRenderer(documentLayer, interactionLayer, overlayLayer) {
    return {
        renderFull(diagram, visualState, theme = LIGHT_THEME) {
            documentLayer.innerHTML = documentMarkup(diagram, theme);
            interactionLayer.innerHTML = interactionMarkup(diagram, visualState, theme);
            overlayLayer.innerHTML = overlayMarkup(diagram, visualState, theme);
        },
        renderUi(diagram, visualState, theme = LIGHT_THEME) {
            interactionLayer.innerHTML = interactionMarkup(diagram, visualState, theme);
            overlayLayer.innerHTML = overlayMarkup(diagram, visualState, theme);
        },
        renderOverlay(diagram, visualState, theme = LIGHT_THEME) {
            overlayLayer.innerHTML = overlayMarkup(diagram, visualState, theme);
        },
        patchDrag(diagram, visualState, nodeId, theme = LIGHT_THEME) {
            const node = diagram.nodes.find(({ id }) => id === nodeId);
            if (!node)
                return;
            const selectorId = cssEscape(nodeId);
            const nodeGroup = documentLayer.querySelector(`[data-node-id="${selectorId}"]`);
            nodeGroup?.setAttribute("transform", `translate(${node.x} ${node.y})`);
            const ports = interactionLayer.querySelector(`[data-ports-for="${selectorId}"]`);
            ports?.setAttribute("transform", `translate(${node.x} ${node.y})`);
            const guideGroup = interactionLayer.querySelector(".alignment-guides");
            const guides = interactionMarkup({ nodes: diagram.nodes.length ? [node] : [], edges: [] }, { ...visualState, selection: null }, theme).match(/<g class="alignment-guides">[\s\S]*<\/g>$/)?.[0];
            if (guideGroup && guides)
                guideGroup.outerHTML = guides;
            const index = new Map(diagram.nodes.map((item) => [item.id, item]));
            for (const edge of diagram.edges) {
                if (edge.from !== nodeId && edge.to !== nodeId)
                    continue;
                const element = documentLayer.querySelector(`[data-edge-id="${cssEscape(edge.id)}"]`);
                if (element)
                    element.outerHTML = edgeMarkup(edge, index, theme, diagram.edges);
            }
        },
    };
}
