export const THEME_STORAGE_KEY = "app-anatomy:theme";
const CATEGORY_INK_LIGHT = "#1F1E1B";
const CATEGORY_INK_DARK = "#ECEAE4";
export const LIGHT_THEME = Object.freeze({
    name: "light",
    canvas: "#FBFAF8",
    surface: "#FFFFFF",
    surface2: "#F4F3EF",
    ink: "#1F1E1B",
    inkMuted: "#6B6963",
    border: "#D9D7D0",
    accent: "#6965DB",
    accentSoft: "#E8E7FB",
    danger: "#B3352C",
    dangerSoft: "#FBE4E2",
    dot: "#DDDBD2",
    edge: "#4B4A46",
    exportBackground: "#FFFFFF",
    categories: Object.freeze({
        pessoas: { fill: "#FFE9DC", stroke: "#A94E1D", ink: CATEGORY_INK_LIGHT },
        dispositivos: { fill: "#E3F0FF", stroke: "#2765AD", ink: CATEGORY_INK_LIGHT },
        rede: { fill: "#DFF3EE", stroke: "#16735D", ink: CATEGORY_INK_LIGHT },
        backend: { fill: "#EAE8FB", stroke: "#5145B5", ink: CATEGORY_INK_LIGHT },
        dados: { fill: "#FFF3D1", stroke: "#7A5700", ink: CATEGORY_INK_LIGHT },
        integracoes: { fill: "#FCE7F3", stroke: "#993267", ink: CATEGORY_INK_LIGHT },
        seguranca: { fill: "#FBE4E2", stroke: "#9B271F", ink: CATEGORY_INK_LIGHT },
        infra: { fill: "#ECEFF3", stroke: "#48596B", ink: CATEGORY_INK_LIGHT },
        anotacoes: { fill: "#F2EFE6", stroke: "#6E6555", ink: CATEGORY_INK_LIGHT },
    }),
});
export const DARK_THEME = Object.freeze({
    name: "dark",
    canvas: "#201F1C",
    surface: "#2A2925",
    surface2: "#34322D",
    ink: "#ECEAE4",
    inkMuted: "#A5A29A",
    border: "#45433D",
    accent: "#8B87F0",
    accentSoft: "#37356B",
    danger: "#E5786D",
    dangerSoft: "#4A2320",
    dot: "#33322D",
    edge: "#C9C6BE",
    exportBackground: "#FFFFFF",
    categories: Object.freeze({
        pessoas: { fill: "#3A2A1E", stroke: "#F0AF7C", ink: CATEGORY_INK_DARK },
        dispositivos: { fill: "#1F2C3D", stroke: "#91C6F5", ink: CATEGORY_INK_DARK },
        rede: { fill: "#1E332D", stroke: "#78D6BA", ink: CATEGORY_INK_DARK },
        backend: { fill: "#2A2745", stroke: "#B4AEFF", ink: CATEGORY_INK_DARK },
        dados: { fill: "#3A3218", stroke: "#EBC970", ink: CATEGORY_INK_DARK },
        integracoes: { fill: "#3A2230", stroke: "#F19BC9", ink: CATEGORY_INK_DARK },
        seguranca: { fill: "#3D211F", stroke: "#F29B93", ink: CATEGORY_INK_DARK },
        infra: { fill: "#262B31", stroke: "#A8BACE", ink: CATEGORY_INK_DARK },
        anotacoes: { fill: "#31302A", stroke: "#CFC8B8", ink: CATEGORY_INK_DARK },
    }),
});
export function themeCssVariables(theme) {
    return {
        "--bg-canvas": theme.canvas,
        "--surface": theme.surface,
        "--surface-2": theme.surface2,
        "--ink": theme.ink,
        "--ink-muted": theme.inkMuted,
        "--border": theme.border,
        "--accent": theme.accent,
        "--accent-soft": theme.accentSoft,
        "--danger": theme.danger,
        "--danger-soft": theme.dangerSoft,
        "--dot": theme.dot,
    };
}
export function parseThemePreference(value) {
    return value === "dark" ? "dark" : "light";
}
