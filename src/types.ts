import type { CategoryKey } from "./theme.js";

export interface BlockDef {
  id: string;
  nome: string;
  icone: string;
  iconId: string;
  desc: string;
  /** Tamanho inicial do nó quando difere do padrão (ex.: bloco de texto). */
  defaultSize?: { w: number; h: number };
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  iconId: string;
  themeKey: CategoryKey;
  blocos: BlockDef[];
}

export interface DiagNode {
  id: string;
  def: string;
  x: number;
  y: number;
  label: string;
  /** Largura personalizada; ausente = largura padrão do bloco. */
  w?: number;
  /** Altura personalizada; ausente = altura padrão do bloco. */
  h?: number;
  /** Tint do vidro em #RRGGBB; ausente = vidro transparente. */
  color?: string;
}

/** Face de um nó onde uma conexão pode ancorar (porta). */
export type PortSide = "top" | "right" | "bottom" | "left";

/** Estilo do trajeto de uma conexão. */
export type EdgeLineStyle = "straight" | "ortho" | "curved";

/** Ponto de passagem arrastável de uma conexão, em coordenadas do diagrama. */
export interface EdgePoint {
  x: number;
  y: number;
}

export interface DiagEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** Porta fixa na origem; ausente = âncora flutuante (face mais próxima). */
  fromSide?: PortSide;
  /** Porta fixa no destino; ausente = âncora flutuante. */
  toSide?: PortSide;
  /** Estilo do trajeto; ausente = linha reta (compatível com docs antigos). */
  line?: EdgeLineStyle;
  /** Pontos de passagem definidos pelo usuário. */
  points?: EdgePoint[];
}

export interface Diagram {
  nodes: DiagNode[];
  edges: DiagEdge[];
}

export interface DiagramMeta {
  title: string;
  savedAt?: string;
  catalogVersion?: string;
}

export interface DiagramFile {
  format: "anatomia";
  version: 1;
  meta: DiagramMeta;
  nodes: DiagNode[];
  edges: DiagEdge[];
}
