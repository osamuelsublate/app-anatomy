// Set autoral de glifos profissionais para os blocos do catálogo.
// Gramática: grade 24×24, traço 2 centrado, terminais/junções arredondados,
// monocromia em uma cor (a da categoria), no máximo 1 área preenchida de
// assinatura por glifo (marcada com fill="__C__"). Geometrias derivadas das
// convenções ISO 5807 / Cisco / UML / C4 e dos guias Lucide (ISC),
// Material Symbols e IBM Carbon (Apache-2.0) — ver docs/pesquisa-formas-profissionais.md.
const G = Object.freeze({
    // ---------- Pessoas ----------
    usuario: `<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>`,
    dev: `<circle cx="9" cy="8" r="3.5"/><path d="M3 19.5c1.2-3.3 3.4-5 6-5 1.1 0 2.1.3 3 .8"/><path d="m15.5 12.5-3 3 3 3"/><path d="m19.5 12.5 3 3-3 3"/>`,
    ops: `<circle cx="9" cy="8" r="3.5"/><path d="M3 19.5c1.2-3.3 3.4-5 6-5 1 0 2 .3 2.9.8"/><circle cx="17.5" cy="16.5" r="2.4"/><path d="M17.5 12.4v1.7M17.5 19v1.7M13.4 16.5h1.7M20 16.5h1.7"/>`,
    suporte: `<path d="M5 13v-2a7 7 0 0 1 14 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1.8"/><rect x="16.5" y="13" width="4" height="6" rx="1.8"/><path d="M19 19v.6a2 2 0 0 1-2 2h-3.4"/>`,
    atacante: `<circle cx="10" cy="8" r="3.5"/><path d="M4 19.5c1.3-3.4 3.6-5 6.5-5 1.3 0 2.5.3 3.5.9"/><path d="m16.5 15.5 4.5 4.5M21 15.5 16.5 20"/>`,
    // ---------- Dispositivos & Frontend ----------
    computador: `<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M4 16l-1.3 2.6a1 1 0 0 0 .9 1.4h16.8a1 1 0 0 0 .9-1.4L20 16"/>`,
    celular: `<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>`,
    navegador: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6" cy="6.5" r=".9" fill="__C__" stroke="none"/><circle cx="8.8" cy="6.5" r=".9" fill="__C__" stroke="none"/><circle cx="11.6" cy="6.5" r=".9" fill="__C__" stroke="none"/>`,
    frontend: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><rect x="6" y="11.5" width="5" height="5.5" rx="1"/><path d="M14 12.5h4M14 15.5h4"/>`,
    cookies: `<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1" fill="__C__" stroke="none"/><circle cx="14.6" cy="8.6" r="1" fill="__C__" stroke="none"/><circle cx="9.8" cy="14.6" r="1" fill="__C__" stroke="none"/><circle cx="15" cy="13.6" r="1" fill="__C__" stroke="none"/><circle cx="12.4" cy="17" r=".9" fill="__C__" stroke="none"/>`,
    // ---------- Rede & Caminho ----------
    roteador: `<rect x="3" y="13" width="18" height="7" rx="1.8"/><path d="M7 13V8"/><circle cx="7" cy="16.5" r=".9" fill="__C__" stroke="none"/><path d="M13 16.5h4.5"/><path d="M13.6 8.2a5.4 5.4 0 0 1 7.2 0"/><path d="M15.5 10.6a2.7 2.7 0 0 1 3.4 0"/>`,
    isp: `<path d="M8 21 12 4l4 17"/><path d="M10.3 10.5h3.4M9.4 15.5h5.2"/><path d="M8.4 8.3A5 5 0 0 1 8.4 2.7"/><path d="M15.6 8.3a5 5 0 0 0 0-5.6"/>`,
    internet: `<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.8" ry="8.5"/><path d="M3.8 9.2h16.4M3.8 14.8h16.4"/>`,
    dominio: `<path d="M12.6 3H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l7.4 7.4a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L14 3.6a2 2 0 0 0-1.4-.6Z"/><circle cx="8" cy="8" r="1.2" fill="__C__" stroke="none"/>`,
    dns: `<rect x="4" y="3.5" width="16" height="17" rx="2"/><circle cx="8" cy="9" r=".9" fill="__C__" stroke="none"/><path d="M10.3 9h1.6"/><path d="m12.8 7.9 1.1 1.1-1.1 1.1"/><path d="M15.4 9h1.6"/><circle cx="8" cy="15" r=".9" fill="__C__" stroke="none"/><path d="M10.3 15h1.6"/><path d="m12.8 13.9 1.1 1.1-1.1 1.1"/><path d="M15.4 15h1.6"/>`,
    cdn: `<circle cx="12" cy="12" r="6.5"/><path d="M12 5.5V12l-5.9 3.9M12 12l5.9 3.9"/><circle cx="12" cy="3.6" r="1.7"/><circle cx="4.6" cy="16.4" r="1.7"/><circle cx="19.4" cy="16.4" r="1.7"/>`,
    loadbalancer: `<path d="M2 12h5.4"/><path d="m5.7 10.3 1.9 1.7-1.9 1.7"/><rect x="8.6" y="9.2" width="5.6" height="5.6" rx="1.2"/><path d="M14.5 12h3.4m-3.2-1.6 3.7-2.9m-3.7 6.1 3.7 2.9"/><circle cx="20" cy="12" r="1.3" fill="__C__" stroke="none"/><circle cx="19.7" cy="6.6" r="1.3" fill="__C__" stroke="none"/><circle cx="19.7" cy="17.4" r="1.3" fill="__C__" stroke="none"/>`,
    proxy: `<rect x="9" y="9" width="6" height="6" rx="1.2"/><path d="M2 12h5.2m-1.8-1.6L7.2 12l-1.8 1.6"/><path d="M16.8 12H22m-1.8-1.6L22 12l-1.8 1.6"/>`,
    vpn: `<path d="M4 20v-8a8 8 0 0 1 16 0v8"/><rect x="9" y="13.5" width="6" height="5" rx="1"/><path d="M10.4 13.5v-1.2a1.6 1.6 0 0 1 3.2 0v1.2"/>`,
    // ---------- Backend ----------
    servidorweb: `<rect x="3" y="4" width="11.5" height="16" rx="1.5"/><path d="M3 9.3h11.5M3 14.6h11.5"/><circle cx="5.6" cy="6.6" r=".9" fill="__C__" stroke="none"/><circle cx="5.6" cy="12" r=".9" fill="__C__" stroke="none"/><circle cx="5.6" cy="17.3" r=".9" fill="__C__" stroke="none"/><circle cx="18.4" cy="17" r="3.4"/><ellipse cx="18.4" cy="17" rx="1.5" ry="3.4"/><path d="M15.1 17h6.6"/>`,
    api: `<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7.5 10h7.6"/><path d="m13.3 8.2 2.2 1.8-2.2 1.8"/><path d="M16.5 14H8.9"/><path d="M10.7 12.2 8.5 14l2.2 1.8"/>`,
    monolito: `<rect x="5.5" y="4" width="13" height="16" fill="__C__" fill-opacity=".2"/><path d="M5.5 9.3h13M5.5 14.6h13"/>`,
    microsservico: `<path d="M12 3.5 19.4 7.75v8.5L12 20.5 4.6 16.25v-8.5Z"/><circle cx="12" cy="12" r="1.4" fill="__C__" stroke="none"/>`,
    auth: `<circle cx="7" cy="12" r="4"/><path d="M11 12h10"/><path d="M17.5 12v3M20.5 12v3"/>`,
    permissoes: `<path d="M12 3 5 5.6v6.1c0 4.3 2.8 7.4 7 9.3 4.2-1.9 7-5 7-9.3V5.6Z"/><path d="m8.8 12 2.3 2.3 4.4-4.4"/>`,
    regras: `<path d="M12 3.5 15.5 7 12 10.5 8.5 7Z"/><path d="M12 10.5V13M7 13h10M7 13v2M17 13v2"/><rect x="4" y="15" width="6" height="5" rx="1"/><rect x="14" y="15" width="6" height="5" rx="1"/>`,
    worker: `<circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.5" fill="__C__" stroke="none"/><path d="M12 3.5v2.8M12 17.7v2.8M3.5 12h2.8M17.7 12h2.8M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>`,
    fila: `<rect x="2.5" y="9" width="4.2" height="6" rx="1"/><rect x="8" y="9" width="4.2" height="6" rx="1"/><rect x="13.5" y="9" width="4.2" height="6" rx="1"/><path d="M19 12h3m-1.6-1.5L22 12l-1.6 1.5"/>`,
    cron: `<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5V12l3.8 2.2"/>`,
    websocket: `<path d="M13.2 2.5 5.5 13.5h5l-1.7 8 7.7-11h-5Z" fill="__C__" fill-opacity=".2"/>`,
    // ---------- Dados ----------
    sql: `<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>`,
    nosql: `<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M10.2 11c-1 .4-1 1.2-1 2 0 .7 0 1.4-1.2 1.7 1.2.3 1.2 1 1.2 1.7 0 .8 0 1.6 1 2" stroke-width="1.7"/><path d="M13.8 11c1 .4 1 1.2 1 2 0 .7 0 1.4 1.2 1.7-1.2.3-1.2 1-1.2 1.7 0 .8 0 1.6-1 2" stroke-width="1.7"/>`,
    cache: `<ellipse cx="10.5" cy="7" rx="6.5" ry="2.6"/><path d="M4 7v10c0 1.4 2.9 2.6 6.5 2.6 1 0 2-.1 2.9-.3"/><path d="M17 7v3.5"/><path d="M19 10.5 15.6 15.7h2.6l-1.2 5.3 3.4-5.3h-2.6Z" fill="__C__" fill-opacity=".2" stroke-width="1.6"/>`,
    arquivos: `<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>`,
    backup: `<ellipse cx="12" cy="6.5" rx="5.5" ry="2.2"/><path d="M6.5 6.5v5c0 1.2 2.46 2.2 5.5 2.2s5.5-1 5.5-2.2v-5"/><path d="M5 16.5a7.2 7.2 0 0 0 13.8 1.9"/><path d="m19.3 15.7-.4 2.8-2.7-.5"/>`,
    warehouse: `<path d="M3 20V9.5L12 4l9 5.5V20"/><path d="M2.5 20h19"/><ellipse cx="9" cy="13.5" rx="1.9" ry=".8"/><path d="M7.1 13.5v3.8c0 .5.9.9 1.9.9s1.9-.4 1.9-.9v-3.8"/><ellipse cx="15" cy="13.5" rx="1.9" ry=".8"/><path d="M13.1 13.5v3.8c0 .5.9.9 1.9.9s1.9-.4 1.9-.9v-3.8"/>`,
    // ---------- Integrações ----------
    email: `<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/>`,
    pagamentos: `<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18" stroke-width="2.6"/><path d="M6.5 14.5h4"/>`,
    loginsocial: `<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.4" cy="10.4" r="2"/><path d="M5.6 15.8c.6-1.5 1.6-2.3 2.8-2.3s2.2.8 2.8 2.3"/><path d="M14 9.5h4.5"/><path d="m14.4 14.3 1.3 1.3 2.6-2.6"/>`,
    whatsapp: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>`,
    push: `<path d="M18 10.5a6 6 0 1 0-12 0c0 3.5-1.5 5-2 6h16c-.5-1-2-2.5-2-6Z"/><path d="M10.2 20a2 2 0 0 0 3.6 0"/>`,
    apiterceiros: `<path d="M9 6.5V3M15 6.5V3"/><path d="M7 6.5h10V10a5 5 0 0 1-10 0Z"/><path d="M12 15v3a2.6 2.6 0 0 1-2.6 2.6"/>`,
    ia: `<path d="M11 2.5c.75 4 2.7 5.95 6.7 6.7-4 .75-5.95 2.7-6.7 6.7-.75-4-2.7-5.95-6.7-6.7 4-.75 5.95-2.7 6.7-6.7Z" fill="__C__" fill-opacity=".15"/><path d="M18.5 14.5c.4 2 1.2 2.8 3.2 3.2-2 .4-2.8 1.2-3.2 3.2-.4-2-1.2-2.8-3.2-3.2 2-.4 2.8-1.2 3.2-3.2Z" fill="__C__" stroke="none"/>`,
    mapas: `<path d="M12 21.5S5 14.8 5 9.8a7 7 0 0 1 14 0c0 5-7 11.7-7 11.7Z"/><circle cx="12" cy="9.8" r="2.6"/>`,
    webhook: `<circle cx="14" cy="3.9" r="1.4" fill="__C__" stroke="none"/><path d="M14 5.4v6.1a4.75 4.75 0 1 1-9.5 0v-1.6"/><path d="m4.5 9.9 1.9.9"/>`,
    // ---------- Segurança ----------
    https: `<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="14.6" r="1.3" fill="__C__" stroke="none"/><path d="M12 15.9v1.8"/>`,
    firewall: `<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.4h18"/><path d="M9 5v4.7M15 5v4.7M6 9.7v4.7M12 9.7v4.7M18 9.7v4.7M9 14.4V19M15 14.4V19"/>`,
    waf: `<path d="M12 3 5 5.6v6.1c0 4.3 2.8 7.4 7 9.3 4.2-1.9 7-5 7-9.3V5.6Z"/><path d="M6.2 9.5h11.6M5.6 13.5h12.8"/><path d="M9.5 6.4v3.1M14.5 6.4v3.1M12 9.5v4M8.5 13.5v2.6M15.5 13.5v2.6"/>`,
    segredos: `<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r="1.2" fill="__C__" stroke="none"/><path d="M12 8.4V7M12 17v-1.4M8.4 12H7M17 12h-1.4"/>`,
    ddos: `<path d="M15.5 4.5 10.5 6.3v4.4c0 3.1 2 5.3 5 6.7 3-1.4 5-3.6 5-6.7V6.3Z"/><path d="M2.5 6.5h4.2m-1.7-1.4 1.9 1.4-1.9 1.4"/><path d="M2.5 11.5h4.7m-1.7-1.4 1.9 1.4-1.9 1.4"/><path d="M2.5 16.5h4.2m-1.7-1.4 1.9 1.4-1.9 1.4"/>`,
    // ---------- Infra & Operação ----------
    servidor: `<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M4 9.2h16M4 14.9h16"/><circle cx="7" cy="6.3" r=".9" fill="__C__" stroke="none"/><circle cx="7" cy="12" r=".9" fill="__C__" stroke="none"/><circle cx="7" cy="17.7" r=".9" fill="__C__" stroke="none"/><path d="M10.5 6.3H17M10.5 12H17M10.5 17.7H17"/>`,
    container: `<rect x="3.5" y="7" width="17" height="12.5" rx="1.5"/><path d="M3.5 10.5h17"/><path d="M12 7v12.5"/><path d="M10 3.8h4"/><path d="M12 3.8V7"/>`,
    k8s: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4v3.6M12 16.4V20M4 12h3.6M16.4 12H20M6.3 6.3l2.6 2.6M15.1 15.1l2.7 2.7M17.7 6.3l-2.6 2.6M8.9 15.1l-2.6 2.6"/>`,
    nuvem: `<path d="M17.5 18.5H7a4.3 4.3 0 0 1-.4-8.6A6 6 0 0 1 18.2 8a4.55 4.55 0 0 1-.7 10.5Z"/>`,
    datacenter: `<rect x="6" y="3.5" width="12" height="17"/><path d="M4 20.5h16"/><rect x="8.6" y="6" width="2.2" height="2.2" fill="__C__" stroke="none"/><rect x="13.2" y="6" width="2.2" height="2.2" fill="__C__" stroke="none"/><rect x="8.6" y="10" width="2.2" height="2.2" fill="__C__" stroke="none"/><rect x="13.2" y="10" width="2.2" height="2.2" fill="__C__" stroke="none"/><rect x="8.6" y="14" width="2.2" height="2.2" fill="__C__" stroke="none"/><rect x="13.2" y="14" width="2.2" height="2.2" fill="__C__" stroke="none"/><path d="M11 20.5v-2.8h2v2.8"/>`,
    ambientes: `<path d="M9.7 3h4.6"/><path d="M10.6 3v5.6L5.9 18.4A1.8 1.8 0 0 0 7.5 21h9a1.8 1.8 0 0 0 1.6-2.6L13.4 8.6V3"/><path d="M8.2 15.5h7.6"/>`,
    deploy: `<path d="M12 2.5c2.9 1.9 4.4 5 4.4 8.7 0 1.9-.4 3.7-1.1 5.3H8.7a13.2 13.2 0 0 1-1.1-5.3c0-3.7 1.5-6.8 4.4-8.7Z"/><circle cx="12" cy="9.5" r="1.7"/><path d="M8.7 13.4c-1.7.9-2.8 2.4-3.2 4.4l3.5-1.1M15.3 13.4c1.7.9 2.8 2.4 3.2 4.4l-3.5-1.1"/><path d="M10.6 19c.3 1.2.8 2.1 1.4 2.9.6-.8 1.1-1.7 1.4-2.9"/>`,
    git: `<circle cx="7" cy="6" r="2.2"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="9" r="2.2"/><path d="M7 8.2v7.6"/><path d="M7 13c0-3.5 3.4-4 7.8-4"/>`,
    monitoramento: `<path d="M2.5 12h4.2l2.2-6 3.4 12 2.5-8.5 1.4 2.5h5.3"/>`,
    logs: `<path d="M14.5 3.5H6.5A1.5 1.5 0 0 0 5 5v15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V8Z"/><path d="M14.5 3.5V8H19"/><path d="M8.2 12h7.6M8.2 15h7.6M8.2 18h4.6"/>`,
    analytics: `<path d="M3.5 20.5h17"/><rect x="5.5" y="12" width="3" height="8.5"/><rect x="10.5" y="7.5" width="3" height="13"/><rect x="15.5" y="14" width="3" height="6.5"/>`,
    alertas: `<path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><circle cx="12" cy="17" r="1.1" fill="__C__" stroke="none"/>`,
    // ---------- Anotações ----------
    texto: `<path d="M5 7V4.5h14V7"/><path d="M12 4.5v15"/><path d="M9 19.5h6"/>`,
});
const FALLBACK = `<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.3-.9 1-.9 1.7"/><circle cx="12" cy="17" r="1.1" fill="__C__" stroke="none"/>`;
/** Glifo representativo de cada categoria (usado no cabeçalho da paleta). */
export const CATEGORY_GLYPHS = Object.freeze({
    pessoas: "usuario",
    dispositivos: "computador",
    rede: "internet",
    backend: "worker",
    dados: "sql",
    integracoes: "apiterceiros",
    seguranca: "https",
    infra: "servidor",
    anotacoes: "texto",
});
export function hasGlyph(defId) {
    return defId in G;
}
function glyphBody(defId, color) {
    return (G[defId] ?? FALLBACK).replaceAll("__C__", color);
}
/**
 * Glifo para dentro do SVG do canvas/export: cor explícita (o export não tem CSS).
 * O scale também escala o traço (2px@24 ≈ 3px@36), mantendo o peso óptico.
 */
export function glyphMarkup(defId, x, y, size, color) {
    const scale = size / 24;
    return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphBody(defId, color)}</g>`;
}
/** Glifo standalone para HTML (paleta, quick picker): herda a cor via currentColor. */
export function glyphSvg(defId, size, className = "") {
    const cls = className ? ` class="${className}"` : "";
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphBody(defId, "currentColor")}</svg>`;
}
