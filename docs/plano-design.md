# PLANO DE DESIGN — Anatomia, construtor de diagramas
*Consenso do debate de 5 lentes (Minimalismo, Interação, Ícones, Design System, Onboarding) · 2026-08-21*

---

## 1. Direção visual e princípios

**Frase-guia:** *Chrome neutro e quase invisível; toda a cor, o calor e a mão vivem no diagrama — que é a aula.*

**Princípios acordados:**

1. **Chrome contextual, não permanente.** Nada novo visível em repouso: affordances aparecem por seleção, foco, hover ou teclado (regra de teto do Minimalista, aceita por todos).
2. **Cor é semântica, e só no canvas.** Um único acento no chrome; as 8 cores de categoria são o andaime cognitivo do leigo — pastel + stroke, jamais reduzidas a filete.
3. **Modeless por padrão.** Conexão nasce do gesto (porta de borda), não de um modo. Todo caminho de mouse tem equivalente de teclado de primeira classe.
4. **Export é material didático.** PNG/SVG determinísticos entre máquinas e sempre no tema claro, independente do tema da UI.
5. **Zero dependências de runtime permanece.** Assets vetoriais copiados ao repositório; tsgo intocado; nenhum framework.

**Divergências restantes e decisão do moderador:**

| Conflito | Decisão |
|---|---|
| Catálogo: Lucide monocromático (Minimalista) × emoji pinado (Iconista, com apoio de Onboarding) | **Emoji pinado via sprite SVG (Twemoji/Noto).** Resolve o problema real (determinismo, ZWJ/VS16, dark mode) sem sacrificar reconhecimento imediato pelo leigo. Minimalista vencido 3×1. |
| Portas de conexão: hover-only (Interação) × visíveis (Onboarding/Design System) | **Visíveis em seleção e foco; hover como aceleração.** Hover-only exclui teclado, touch e novatos. |
| Tour de primeiro uso (Onboarding) × "o gesto se explica" (Interação/Minimalista) | **Sem tour, sem modal.** O empty state absorve a função: os 3 gestos são anotados em traço rough no próprio canvas vazio. |
| Dark mode como P0 (Design System) × P2 (Minimalista) | **Tokens com `[data-theme]` desde o commit 1 (P0); dark mode entregue em P2.** O usuário exporta claro; a arquitetura é que não pode esperar. |
| Galeria de templates em modal (Onboarding, 1ª versão) × inline | **Inline no canvas vazio**, mais entrada no menu "Novo". Sem interrupção cerimonial. |

---

## 2. Referências: o que copiar, o que evitar

**Copiar:**
- **FigJam** — o *quick create* inteiro: portas nas 4 bordas do elemento selecionado; clique cria o próximo bloco já conectado com editor de texto aberto; arrasto posiciona livre mantendo o conector; `Ctrl+Enter` cria pelo teclado. É o benchmark de custo: 2–3 gestos onde hoje gastamos 7.
- **Excalidraw** — UI em ilhas flutuantes, painel contextual que só existe com seleção, zen mode, menu único de arquivo. E a ironia a corrigir: o app já usa o violeta `#6965db` do Excalidraw, mas o trai com dois acentos rivais.
- **tldraw** — zoom flutuante no canto inferior, chrome cinza-neutro, cor só no conteúdo, focus mode de um botão.
- **Whimsical** — nós pastel + stroke da mesma matiz (o `catalog.ts` já imita; falta curar contraste); set de ícones com grade e peso únicos como meta do futuro set autoral.
- **Eraser** — prova que traço rough default coexiste com ícones nítidos; valida nossa identidade.
- **Mirotone (Miro)** — fundação de tokens: spacing base-8 nomeado, escalas de cor, tudo CSS variables sem bundler.
- **Excalidraw+ / Canva** — laser pointer ativo por padrão ao apresentar; o mesmo artefato vira aula (revelação progressiva ≈ frames, que temos quase grátis na ordem do array `nodes`).
- **draw.io (tema Sketch)** — confirmação de "mínimo + rough" para iniciantes.

**Evitar:**
- **draw.io** — o modal de templates no primeiro uso e o guia de 9 passos.
- **Miro/Lucidchart** — a ausência de dark mode e as falhas de teclado/leitor de tela (Lucid removido de LMS por isso). São exatamente nossos diferenciais baratos.
- **Canva** — o portão obrigatório de galeria antes de criar.

---

## 3. Especificação

### 3.1 Paleta de cores (tokens em `theme.ts` + CSS variables, duas camadas: primitivos OKLCH → semânticos)

**Chrome/UI — tema claro:**

| Token | Hex |
|---|---|
| `--bg-canvas` | `#FBFAF8` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F4F3EF` |
| `--ink` | `#1F1E1B` |
| `--ink-muted` | `#6B6963` |
| `--border` | `#D9D7D0` |
| `--accent` | `#6965DB` |
| `--accent-soft` | `#E8E7FB` |
| `--danger` / `--danger-soft` | `#B3352C` / `#FBE4E2` |
| `--dot` (grid) | `#DDDBD2` |

**Chrome/UI — tema escuro (quente, não azulado):**

| Token | Hex |
|---|---|
| `--bg-canvas` | `#201F1C` |
| `--surface` | `#2A2925` |
| `--surface-2` | `#34322D` |
| `--ink` | `#ECEAE4` |
| `--ink-muted` | `#A5A29A` |
| `--border` | `#45433D` |
| `--accent` | `#8B87F0` |
| `--accent-soft` | `#37356B` |
| `--danger` / `--danger-soft` | `#E5786D` / `#4A2320` |
| `--dot` | `#33322D` |

**Regra do acento único:** `#4a8ff7` (seleção) e `#e8823e` (conexão) são eliminados; ambos os estados usam `--accent`.

**Categorias (fill / stroke), re-derivadas em OKLCH — fill L≈0.94 no claro, L≈0.26 no escuro; stroke↔fill ≥ 3:1; texto sobre fill ≥ 4.5:1 via `--cat-ink`:**

| Categoria | Claro (fill/stroke) | Escuro (fill/stroke) |
|---|---|---|
| Pessoas | `#FFE9DC` / `#C96F3B` | `#3A2A1E` / `#E09A66` |
| Dispositivos & Frontend | `#E3F0FF` / `#3B7AC9` | `#1F2C3D` / `#7FB3E8` |
| Rede & Caminho | `#DFF3EE` / `#2E8C74` | `#1E332D` / `#63C0A5` |
| Backend | `#EAE8FB` / `#6157C9` | `#2A2745` / `#A29BF0` |
| Dados | `#FFF3D1` / `#A8790F` | `#3A3218` / `#D9B45C` |
| Integrações | `#FCE7F3` / `#B0447E` | `#3A2230` / `#E08BB8` |
| Segurança | `#FBE4E2` / `#B3352C` | `#3D211F` / `#E58A82` |
| Infra & Operação | `#ECEFF3` / `#5A6B7E` | `#262B31` / `#93A5B8` |

Nota: o par atual de Dados (`#D9A81E` sobre `#FFF6D6`) falha 3:1 — corrigido acima. Valores são ponto de partida; validação final por medição OKLCH.

**Export:** o serializador SVG/PNG resolve cores **sempre** contra os tokens do tema claro, independente do `[data-theme]` ativo.

### 3.2 Tipografia

- **Chrome:** `system-ui`, escala **12 / 13 / 14 px** (substitui 11.5/12.5/13.5), pesos 400/600. Sem rótulos de texto nos botões de ícone; sem subtítulo no brand.
- **Canvas (rótulos de nós/arestas):** `system-ui` por ora. Fonte manuscrita (ex.: subset local de uma face tipo Virgil/Excalifont) **somente se** passar teste de aceitação de diacríticos PT-BR completos (ç ã õ é ê à) — senão, a "mão" continua vivendo apenas no traço do `rough.ts`.

### 3.3 Iconografia

- **Chrome/toolbar:** subset **Lucide** (ISC), SVGs copiados ao repo, inline, `stroke: currentColor`, 2px de traço, caixa 20px. Herda tema e `:focus-visible` de graça. Fim do mix 🖱️💾↩⛶.
- **Catálogo (62 blocos):** manter a linguagem emoji, **pinando a renderização** — copiar os ~70 SVGs de Twemoji (CC-BY) ou Noto Emoji (Apache-2.0) para `public/icons/`, registrados como `<symbol>` em `<defs>` do SVG e usados via `<use href="#icon-...">`. Compatível com o render por `innerHTML`, serializa no export, idêntico em qualquer SO, nítido em qualquer zoom, legível em fundo escuro. Substitui o `<text font-size="34">` frágil (`main.ts:176`) que quebra ZWJ/VS16 (👩‍💻, 🕵️, ☸️).
- **Auditoria semântica** dos glifos ambíguos após o pin (☸️, 🧭, 🕵️).
- **Futuro (P2):** set autoral rough para os ~12 blocos "Essenciais", cor da categoria no stroke, critério: legível a 50% de zoom.

### 3.4 Layout e zonas

- **Toolbar superior → ilha mínima (≤6 controles):** logo compacto · menu único "☰" (novo, abrir, salvar, export PNG/SVG, limpar — padrão Excalidraw) · undo/redo · botão Apresentar. Sai: par Selecionar/Conectar (extinto pelo modeless), botões soltos de arquivo, rótulos de texto.
- **Zoom:** ilha flutuante no canto inferior direito (−/valor/+/fit), padrão tldraw.
- **Paleta lateral esquerda:** **fixa e aberta por padrão** (o arrasto paleta→canvas é o gesto de 1 movimento, crucial para quem reconhece mas não nomeia). Tier **"Essenciais" (~10 blocos) expandido**, demais 7 categorias recolhidas (progressive disclosure). Busca no topo; `/` foca de qualquer lugar; `Enter` insere o primeiro resultado já conectado à seleção. `Ctrl+.` recolhe todo o chrome.
- **Canvas:** 95% do frame em uso normal; 100% no modo Apresentar. Empty state: 3 cartões-template em traço rough desenhados no próprio canvas ("Anatomia completa de um app", "O caminho de um clique", "Começar do zero" — JSONs em `public/templates/`), mais 3 anotações rough apontando os gestos básicos. Tudo some ao primeiro nó criado.
- **Editor de rótulo flutuante:** mantido; abre automaticamente no quick create.

### 3.5 Microinterações e fluidez

**Pré-requisito técnico (habilita tudo):** corrigir o pipeline de render — durante drag, atualizar apenas o `transform` do `<g>` arrastado em vez de `world.innerHTML = worldMarkup()` a cada `pointermove` (`main.ts:472`); portas renderizadas sempre no markup e reveladas por CSS (`:hover`, `.selected`, `:focus-within`), mantendo o DOM estável para transições e foco.

1. **Conexão por arrasto de porta:** 4 portas nas bordas do nó (visíveis em seleção/foco, hover como aceleração); arrastar porta→nó cria aresta (reusa `connectClick`). Zero modo; `C` vira atalho legado.
2. **Quick create:** clicar numa porta abre mini-picker (Essenciais + busca) que cria o bloco já conectado **com o editor de rótulo aberto** (`openEditor` existente). Meta: adicionar→conectar→renomear em ≤3 gestos (hoje: 7).
3. **Teclado de primeira classe:** `Enter`/`F2` renomeia a seleção; `Ctrl+Enter` cria o próximo bloco conectado à direita; `Tab` navega pelos nós; `Ctrl+D` e `Alt`-drag duplicam; `?` abre overlay de atalhos.
4. **Snap e guias:** snap ao grid de 24px por padrão, `Alt` libera; guias de alinhamento a centros/bordas de vizinhos durante o drag.
5. **Animações — curtas e únicas:** pop de criação de nó `120ms cubic-bezier(0.2, 0.9, 0.3, 1.2)` (scale 0.92→1); pulso na porta ao conectar `160ms ease-out`; fade de hints `200ms ease`; transições de tema `150ms ease`. Nada anima durante drag.
6. **Modo Apresentar (unificado com zen/focus — uma feature, uma tecla):** chrome some, fit automático, cursor com rastro-laser, **revelação progressiva** com `←`/`→` na ordem de criação do array `nodes`. `Esc` sai.
7. **A11y:** `:focus-visible` universal com anel `--accent`; confirmação no destrutivo (limpar); erro visível ao abrir JSON inválido.

---

## 4. Roteiro priorizado

### Nível 1 — Rápidas (horas a dias)

| # | Item | Critério de pronto |
|---|---|---|
| 1.1 | **Tokens duas camadas + acento único** (`theme.ts`, `[data-theme]` no root; colapsar `#4a8ff7`/`#e8823e` em `--accent`) | `grep` de hex em `styles.css`/`main.ts`/`catalog.ts` retorna zero valores fora de theme/tokens |
| 1.2 | **Toolbar mínima** (menu único, zoom flutuante, ícones Lucide, tipografia 12/13/14) | ≤6 controles visíveis; nenhum emoji no chrome; todas as ações antigas alcançáveis |
| 1.3 | **Atalhos básicos** (`Enter`/`F2`, `Ctrl+D`, `?` overlay) | Renomear um nó sem tocar no mouse |
| 1.4 | **Empty state** (3 cartões-template + 3 anotações rough, inline) | Canvas vazio mostra os cartões; clique carrega o JSON; tudo some ao primeiro nó |

### Nível 2 — Médias (1–2 semanas)

| # | Item | Critério de pronto |
|---|---|---|
| 2.1 | **Pipeline de render** (transform no drag; portas via CSS; foco preservado) | `:hover` e foco sobrevivem a um drag completo; nenhuma reconstrução total do mundo durante `pointermove` |
| 2.2 | **Portas + quick create + mini-picker** | Fluxo adicionar→conectar→renomear em ≤3 gestos, cronometrado contra os 7 atuais; funciona por seleção, hover e foco |
| 2.3 | **Pin dos emojis** (sprite `<symbol>/<use>` Twemoji/Noto em `public/icons/`) | Export PNG visualmente idêntico em Linux/macOS/Windows; ☸️ e sequências ZWJ renderizam corretamente; legível em fundo escuro |
| 2.4 | **Snap + guias de alinhamento** | Drag alinha a 24px; `Alt` libera; guias aparecem em centros/bordas de vizinhos |
| 2.5 | **Paleta pedagógica** (Essenciais aberto, categorias recolhidas, `/` + `Enter` insere conectado) | Primeiro uso exibe ~10 blocos, não 62; busca insere sem mouse |
| 2.6 | **Cores de categoria re-derivadas em OKLCH** | Todos os 8 pares medem stroke↔fill ≥3:1 e texto ≥4.5:1, nos dois temas |

### Nível 3 — Grandes (semanas)

| # | Item | Critério de pronto |
|---|---|---|
| 3.1 | **Modo Apresentar unificado** (tecla única, laser, revelação `←`/`→`) | Um frame de vídeo gravado = ≥95% canvas; revelar/ocultar segue ordem de criação; `Esc` restaura tudo |
| 3.2 | **Dark mode** (chrome + canvas; export fixado no claro) | Toggle persiste em localStorage; export byte-a-byte igual nos dois temas; auditoria de contraste passa |
| 3.3 | **A11y de canvas** (Tab pelos nós, portas no foco, `:focus-visible`) | Criar, conectar e renomear 100% via teclado; onde Miro e Lucid falham, nós passamos |
| 3.4 | **Set autoral "Essenciais" + fonte manuscrita** (condicionados) | 12 ícones legíveis a 50% de zoom, coerentes com `rough.ts`; fonte só entra se cobrir diacríticos PT-BR |

Dependências: 1.1 precede 2.6 e 3.2; 2.1 precede 2.2, 3.1 e 3.3.

---

## 5. Rejeitado, e por quê

1. **Modal/galeria de templates no primeiro uso** (padrão draw.io/Canva) — chrome cerimonial antes do primeiro traço; o empty state inline entrega o mesmo valor sem interrupção.
2. **Monocromia total / cor de categoria reduzida a filete de 3px** — destrói o chunking visual que ensina o leigo ("amarelo = dados") e falha WCAG 1.4.11 (contraste não-texto 3:1) em filete fino; a calibração OKLCH resolve o problema real sem amputar.
3. **Lucide monocromático no catálogo** — perdia o reconhecimento pré-atentivo do emoji; o argumento legítimo (export não-determinístico, dark mode) é resolvido pelo pin via sprite, custo muito menor que redesenhar 62 ícones.
4. **Emoji de fonte de sistema (status quo)** — ZWJ/VS16 quebram entre SOs; o PNG do curso mudava conforme a máquina. Defeito de material didático.
5. **Portas de conexão hover-only** — affordance invisível para novato, inexistente para teclado e touch.
6. **Tutorial guiado de 60s / 9 passos** — interação que se explica no gesto (quick create + empty state anotado) vence tour; hint contextual que some cobre o resto.
7. **Botões "+" permanentes em todos os nós** — 20 nós projetados = 80 botões de ruído; affordance só em seleção/foco/hover.
8. **Paleta como overlay recolhido com busca como caminho principal** — quebra o gesto mais barato do app (arrastar da paleta) e exige que o leigo saiba nomear "nginx"; browse é o currículo.
9. **Dark mode como P0** — o entregável do usuário é claro; tokens primeiro, tema escuro como colheita posterior (e o export permanece claro sempre).
10. **Três acentos simultâneos** (`#6965db` + `#4a8ff7` + `#e8823e`) — três acentos são zero acentos.
11. **Frameworks, bundlers ou dependências de runtime** — nada na mesa exigiu; Lucide e Twemoji entram como assets copiados; tsgo e ES modules diretos permanecem.