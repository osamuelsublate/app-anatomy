PESQUISA — Liquid Glass aplicado ao Anatomia

# PESQUISA — Liquid Glass aplicado ao Anatomia

Síntese da frente LIQUID GLASS (linguagem Apple + implementação web + referências de produto), ancorada no código atual (`public/index.html`, `public/styles.css`, `src/theme.ts`). Tudo aqui é executável em CSS/SVG/JS puro, zero deps, sem bundler.

---

## 1. A linguagem em uma página

**O que é.** Liquid Glass (Apple, WWDC 2025) não é imitação de vidro físico: é um "meta-material digital que dobra, molda e concentra luz em tempo real" (sessão WWDC25 219). Materiais anteriores *espalhavam* luz (blur fosco); este *curva* luz. É vidro na óptica e líquido no comportamento — flexiona ao toque, faz morphing gel-like entre estados.

**O princípio central: duas camadas, sempre.** (a) Camada de **conteúdo**, opaca, atrás — o "papel". (b) Camada **funcional** de controles/navegação em vidro, flutuando acima, num **único plano**. HIG, literal: "Don't use Liquid Glass in the content layer". O vidro existe para dar destaque ao conteúdo ("deferring to the content underneath"), nunca a si mesmo. Para o Anatomia: **o canvas e os nós rough são papel opaco; só o chrome flutuante vira vidro.** O contraste papel-artesanal vs. instrumento-óptico-liso é a oposição material que dá profundidade — nenhum dos dois compete com o outro.

**Materiais.** Duas variantes, nunca misturadas: **Regular** (adaptativo, legível sobre qualquer fundo — o default de tudo) e **Clear** (permanentemente transparente, só sobre mídia rica com conteúdo bold por cima). Para o Anatomia: tudo Regular. Além disso há hierarquia de **espessura**: elemento pequeno = vidro fino e discreto; menu/popover/overlay = vidro grosso (sombra mais profunda, tint mais opaco, luz mais difusa). Um token único de vidro é marcador de imitação — precisamos de 2–3 espessuras.

**Propriedades ópticas essenciais.**
- **Lensing**: a refração concentra-se num anel na *borda*; o centro fica límpido. É isso que define a silhueta sem borda desenhada (física: Snell n≈1.5 sobre perfil "squircle convexo" `y=⁴√(1−(1−x)⁴)` — kube.io).
- **Specular highlight**: direcional e geometry-aware — um fio de luz que percorre o contorno, forte no topo/topo-esquerda, quase nulo embaixo. Nunca `border: 1px branco` uniforme.
- **Adaptação ao fundo**: tint, sombra e claro/escuro respondem ao que passa por baixo (sombra mais opaca sobre texto, material escurece sobre fundo claro). Na web estática, o substituto é calibrar para o pior caso e ter espessuras por contexto.
- **Concentricidade**: raio interno = raio externo − padding, cápsulas para botões/pills, curvatura contínua. Raio 12px repetido em tudo grita template.

**Comportamento.** Morphing gota-a-gota entre estados (botão→menu, não fade), lift-to-glass na interação, glow sob o cursor, springs com overshoot leve. Reduce Motion desliga a elasticidade — ela é parte formal do material, e portanto opcional por design.

**As proibições.** Nunca vidro no conteúdo; nunca vidro sobre vidro (popover que nasce de chrome de vidro vira superfície mais opaca); parcimônia ("se tudo é vidro, nada flutua"); tint de marca só na ação primária; degradação deliberada (frosted/alto-contraste já projetados, não um "desliga").

**A crítica que importa.** A própria Apple recuou: betas do iOS 26 ficaram mais foscos, o 26.1 ganhou toggle "Tinted", e o macOS Tahoe usa vidro bem menos que o iOS em telas densas (Tsai, NN/g, Ars). E a falha específica do Tahoe é *exatamente* o nosso risco: "Liquid Glass só fica bom quando tem algo embaixo para refratar; na maioria das janelas é branco sobre branco". O canvas do Anatomia é `#FBFAF8` e frequentemente vazio — **o vidro do app não pode depender do backdrop**: quem carrega a leitura de "vidro" no fundo vazio é rim + sheen + sombra em camadas. O blur é recompensa que "liga" quando nós coloridos passam por baixo no pan.

---

## 2. Anatomia de um elemento de vidro bem-feito

Cinco camadas empilhadas (só a camada 1 = glassmorphism 2020, o clichê a evitar):

**1. Frost (backdrop-filter).** `backdrop-filter: blur(12px) saturate(160%) brightness(1.08)` + prefixo `-webkit-`. Faixa: blur 8–20px, saturate 140–180%, brightness 1.05–1.15 (claro). O `saturate` é o que separa o "vibrante Apple" do cinza lavado. *Divergência entre fontes*: webtricks aponta 12px como sweet spot; NN/g manda errar para mais (25px+) sobre fundo intricado. **Decisão: 12–14px no chrome pequeno do Anatomia** — o fundo é um canvas de cores pastel controladas por nós (theme.ts), não fotos; o critério NN/g ("se dá para ler o fundo, aumente") já é satisfeito com 12px, e blur alto custa GPU proporcional à área×dpr².

**2. Tint.** Nunca branco chapado com alfa. Claro: gradiente `linear-gradient(135deg, rgba(255,255,255,.20), rgba(255,255,255,.08) 50%, rgba(255,255,255,.03))` — o gradiente no tint já sugere volume. Escuro: **tint escuro** `rgba(24,26,32,.45–.60)`, jamais branco translúcido. Com texto por cima: alfa ≥ 0.5. Derivar dos tokens: `--glass-tint: color-mix(in srgb, var(--surface) 55%, transparent)`.

**3. Rim/borda.** Borda de 1px transparente pintada por `conic-gradient` no border-box: clara no topo (~0.65 alfa), fraca nas laterais/base (0.15–0.28). No dark: rim continua **branco** mas com alfa 0.12–0.20 — a aresta clara é o que segue lendo como vidro no escuro.

**4. Specular/sheen.** (a) Inset shadows assimétricas: `inset 0 1px 1px rgba(255,255,255,.45)` no topo, `inset 0 -1px 1px rgba(255,255,255,.18)` embaixo — a assimetria vende "luz de cima". (b) Sheen diagonal num `::after`: `linear-gradient(135deg, rgba(255,255,255,.38), transparent 60%)` com `mix-blend-mode: screen`; metade do alfa no dark.

**5. Sombra externa em camadas.** Dois níveis mínimo: `0 8px 32px rgba(17,18,26,.22), 0 2px 8px rgba(17,18,26,.10)` (claro); no escuro, alfa ~2× (`0 8px 32px rgba(0,0,0,.45)`). Refinamento Comeau: offset vertical 2× o horizontal (luz única na página inteira) e cor da sombra derivada do matiz do canvas (`#FBFAF8` é quente → sombra em cinza-quente, não preto puro, que "lava" a cor).

**6 (opcional). Refração de borda.** Displacement map SVG — só Chromium (ver §3). Progressive enhancement puro.

**7 (opcional). Grain.** `feTurbulence fractalNoise` a 5–8% de opacidade sobre o material — quebra banding e conversa com a estética rough do app. SVG-nativo, universal.

**Escala de espessura (3 presets):**

| Preset | Uso | blur | alfa tint (claro/escuro) | sombra |
|---|---|---|---|---|
| thin | ilha de zoom, hint | 10px | .12 / .45 | 0 2px 8px + 0 8px 24px |
| regular | topbar, paleta (se flutuar) | 12–14px | .16 / .52 | 0 2px 8px + 0 8px 32px |
| thick | menu Arquivo, quickPicker, overlay atalhos | 18–20px | .55–.70 / .72 | 0 18px 60px |

---

## 3. Receitas para a nossa stack (CSS/SVG puro, zero deps)

### 3.1 Base cross-browser (funciona em tudo)

```css
@property --sheen-angle { syntax:'<angle>'; inherits:false; initial-value:210deg; }

:root {
  --glass-tint: rgba(255,255,255,.14);
  --glass-rim:  rgba(255,255,255,.28);
  --glass-blur: 12px;
  --glass-shadow: 0 8px 32px rgb(60 55 40 / .20), 0 2px 8px rgb(60 55 40 / .10);
}
[data-theme="dark"] {
  --glass-tint: rgba(24,26,32,.52);
  --glass-rim:  rgba(255,255,255,.15);
  --glass-shadow: 0 8px 32px rgb(0 0 0 / .45), 0 2px 8px rgb(0 0 0 / .30);
}

.glass {
  position: relative; isolation: isolate;   /* contém pseudo-elementos z<0 */
  border-radius: 16px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--glass-tint), var(--glass-tint)) padding-box,
    conic-gradient(from var(--sheen-angle),
      rgba(255,255,255,.65), var(--glass-rim) 22%,
      rgba(255,255,255,.40) 50%, var(--glass-rim) 78%,
      rgba(255,255,255,.65)) border-box;
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%) brightness(1.08);
  backdrop-filter:         blur(var(--glass-blur)) saturate(160%) brightness(1.08);
  box-shadow: var(--glass-shadow),
    inset 0  1px 1px rgba(255,255,255,.45),
    inset 0 -1px 1px rgba(255,255,255,.18);
  contain: layout paint;
  transition: --sheen-angle .8s ease;
}
.glass:hover { --sheen-angle: 190deg; }     /* luz desliza — análogo web do tilt */
[data-theme="dark"] .glass {
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(130%) brightness(0.95);
  backdrop-filter:         blur(var(--glass-blur)) saturate(130%) brightness(0.95);
}
.glass::after {  /* sheen */
  content:""; position:absolute; inset:0; z-index:-1; border-radius:inherit;
  background: linear-gradient(135deg, rgba(255,255,255,.38),
    rgba(255,255,255,.07) 30%, transparent 60%);
  mix-blend-mode: screen; pointer-events:none;
}
[data-theme="dark"] .glass::after {
  background: linear-gradient(135deg, rgba(255,255,255,.16),
    rgba(255,255,255,.03) 30%, transparent 60%);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: var(--surface); border-color: var(--border); }
}
```

Regras dark que evitam "lama": brightness ≤ 1.0 (clarear backdrop escuro gera cinza lavado), saturate ≤ 140%, sombra com o dobro de alfa, sheen pela metade.

**Concentricidade via calc:** `--r-outer: 16px; --pad: 6px;` e nos filhos `border-radius: calc(var(--r-outer) - var(--pad))`. Botões internos de barras viram cápsula (`border-radius: 999px`) quando a altura permite.

### 3.2 Refração real (progressive enhancement, Chromium-only)

`backdrop-filter: url(#filtroSVG)` funciona **só em Chromium**. Safari: bug aberto desde 2022 (bugs.webkit.org #245510; PRs #68614/#68613 com testes verdes em jul/2026 — pode chegar, hoje não há). Firefox: fechado como "not planned" (MDN BCD #24110). Falha é silenciosa: o backdrop renderiza sem distorção. **Estratégia robusta: camada separada** — refração num `::before` cujo backdrop-filter é *só* `url(#lg-refract)`; onde não suportado, vira no-op e sobra o vidro básico. **Não usar `@supports`** para gatear: Safari pode aceitar a sintaxe sem implementar (confiança média, de memória do relatório técnico — mais um motivo para a arquitetura em camadas, que dispensa detecção).

Pipeline zero-dep: canvas offscreen pinta o mapa de deslocamento (R=dx, G=dy, 128=neutro; perfil squircle, n=1.5, deslocamento máximo no rim, zero no centro) → `toDataURL()` → injeta no `href` do `feImage` → `feDisplacementMap scale=40 xChannelSelector=R yChannelSelector=G`. **Gotcha crítico (kube.io): o feImage não escala com o elemento** — um mapa por superfície, no tamanho exato, regenerado no resize. Como as superfícies do Anatomia têm tamanhos fixos/semiestáveis, gerar no boot + resize é barato. Alternativa 100% declarativa (sem JS): `feTurbulence baseFrequency=0.008 → feGaussianBlur 2 → feDisplacementMap scale=24` — vidro "ondulado", não a lente Apple; aceitável só se não quisermos o passo de JS.

*Veredito*: implementar a refração como fase 2 opcional. O vidro básico + rim + sombra entrega ~85% da percepção; a refração é diferencial fino para usuários Chromium (maioria do público de curso).

### 3.3 Qualidade do blur em superfícies de borda

`backdrop-filter` amostra só os pixels diretamente atrás — conteúdo prestes a entrar sob a barra não influencia o blur, criando corte irreal (Comeau). Para a topbar: elemento de backdrop com `height:200%` mascarado por `mask-image: linear-gradient(to bottom, black 50%, transparent 50%)` + `pointer-events:none`. Aplicar se o corte incomodar visualmente; é polimento, não fundação.

### 3.4 Acessibilidade, temas, modo apresentar

- `prefers-reduced-transparency`: **Chrome/Edge 118+ apenas** (Safari nada, FF atrás de flag). Usar a media query **e** um toggle manual `.reduce-glass` no app — obrigatório, não opcional.
- `prefers-contrast: more`: suporte amplo — segundo gatilho para o mesmo fallback.
- Fallback sólido: `background: var(--surface)` + `border: var(--border)` + manter as sombras (a separação de plano não pode depender do vidro).
- `prefers-reduced-motion`: congela `--sheen-angle` e qualquer spring.
- **Modo apresentar: `.reduce-glass` por padrão.** Projetores têm contraste péssimo; a Apple mesma reservaria Clear para esse contexto, mas a decisão certa aqui é o oposto — sólido. O instrutor apresenta para leigos; legibilidade > espetáculo.
- Pan/zoom: se houver jank (todo vidro sobre o canvas recaptura o backdrop a cada frame), classe `.is-panning` troca backdrop-filter por `background` semi-opaco — imperceptível em movimento.
- Orçamento de performance: **3–6 superfícies pequenas de vidro, nunca vidro cobrindo região grande/rolável.** `contain: layout paint` em cada uma. Em HiDPI (dpr ≥ 2) a captura custa ~4×: manter ilhas pequenas em px.

---

## 4. Mapeamento elemento a elemento

Critério: vidro **só** no chrome que flutua sobre o canvas; conteúdo e superfícies de edição são papel. O que nasce de vidro fica *mais opaco* (nunca vidro sobre vidro).

| Elemento | Material | Justificativa |
|---|---|---|
| `#topbar` | **Vidro regular** (blur 12px, tint .16/.52) | Chrome de navegação canônico. Hoje é `var(--surface)` sólido colado no topo; ganha mais se destacado como plano flutuante (ver nota abaixo). Botões internos (`.icon-button`) viram cápsulas concêntricas, sem fundo próprio em repouso — hover ganha `--accent` a 4%, ativo a 8% (rampa giorgio-a11y). |
| `#fileMenu` (menu Arquivo) | **Vidro thick** (blur 18px, tint .60+/.72) ou quase-sólido | Nasce da topbar (de vidro): precisa ser mais opaco que ela. Tem texto denso (itens de menu) → material Regular grosso, jamais Clear. Se a topbar virar vidro, a opção mais segura é `color-mix(surface 88%, transparent)` + blur leve. |
| `#palette` (paleta lateral) | **Sólida com leve tint** (`--surface` + grain sutil) | É coluna própria do layout, não sobrepõe o canvas — regra Setproduct: translucência só onde o pano de fundo é controlado/sobreposto. Os `.block-item` são *conteúdo* (catálogo). Se um dia a paleta virar painel flutuante sobre o canvas (estilo tldraw), aí sim vidro regular. |
| `#zoomControls` (ilha de zoom) | **Vidro thin** (blur 10px, cápsula) | O caso perfeito: pequena, flutua sobre o canvas, nós coloridos passam por baixo no pan — é onde o efeito mais "liga". Forma: cápsula única contendo os botões; raio interno concêntrico. |
| `#hint` | **Vidro thin** | Já usa `color-mix(surface 88%, transparent)` — a meio caminho. Adicionar blur 8–10px + rim; texto curto, alfa do tint ≥ .6 atrás do rótulo. |
| `#quickPicker` (popover "criar conectado") | **Vidro thick → quase-sólido** | Popover com lista de resultados (texto) sobre o canvas. Tint .65+; a leitura deve ser instantânea durante o fluxo de criação. |
| `#labelEditor` | **Sólido, sempre** | É edição de conteúdo *dentro* do conteúdo — camada de papel por definição. Vidro aqui violaria a regra nº 1 e atrapalharia leitura do texto sendo digitado. Fundo `--surface` opaco, borda `--accent`. |
| `#shortcutsOverlay` | **Vidro thick** (blur 20px, tint .55/.72, sombra 0 18px 60px) | O momento "menu grande = vidro grosso" da Apple: overlay transiente, conteúdo por baixo vira contexto desfocado. Texto tabular exige tint alto. |
| `#canvas` + nós/arestas | **Papel opaco, intocável** | Camada de conteúdo. Os retângulos rough continuam 100% sólidos — o contraste com o chrome liso é o que cria os dois planos. |
| Modo apresentar | **`.reduce-glass` por padrão** | Projetores + vidro = contraste ruim. Controles mínimos sólidos. |
| `select`/`input` da topbar (`#documentSelect`, `#documentTitle`) | Sem vidro próprio | Vivem *sobre* a topbar de vidro — fundo transparente ou `--surface-2` translúcido leve; nunca segundo backdrop-filter (vidro sobre vidro). |

**Divergência decidida — a topbar.** O relatório de produto alerta (lição Figma UI3) que chrome flutuante demais gera ruído e desperdiça área. Decisão: a topbar continua ancorada full-width no topo, mas ganha o material de vidro + *scroll edge effect* (sem linha divisória dura; o encontro com o canvas é o próprio blur). Só a ilha de zoom e popovers são flutuantes de verdade. Isso mantém previsibilidade (crítica NN/g nº 1) e fica dentro do orçamento de 4 superfícies com backdrop-filter simultâneas no pior caso (topbar, ilha, hint, um popover).

**Tint de marca (#6965DB).** Rampa cirúrgica: 4% hover, 8% seleção, 15% chip/estado ativo, 30% borda de seleção, 100% só no CTA/elemento ativo. Jamais tingir o material do vidro inteiro de roxo.

---

## 5. Checklist "parece que a Apple fez"

1. **Refração/contraste na borda, centro límpido** — anel perimetral, não blur uniforme decorativo (marcador nº 1 de imitação).
2. **Rim assimétrico**: fio de luz forte no topo, quase ausente na base — nunca `1px solid rgba(255,255,255,.3)` uniforme.
3. **Saturate no backdrop** (140–160%) — é o que separa "vibrante" de cinza lavado.
4. **Tint em gradiente**, não alfa chapado; escuro no dark mode (nunca branco translúcido sobre fundo escuro).
5. **Três espessuras de material** mapeadas a tamanho/função — botão fino, menu grosso; um token único de vidro denuncia template.
6. **Concentricidade rigorosa**: raio interno = raio externo − padding, via `calc()`; cápsulas em barras e pills; nada de 12px em tudo.
7. **Disciplina de camadas**: vidro só no chrome, canvas/nós 100% opacos, zero vidro-sobre-vidro (popover de barra de vidro = mais opaco), um único plano de controles.
8. **Sombra em camadas com luz única** (vertical 2× horizontal em toda a página), cor derivada do matiz do canvas, opacidade maior no dark.
9. **Sheen direcional que responde a input** (hover desliza `--sheen-angle`), não glow difuso ambiente; movimento só como resposta, nunca decoração.
10. **Tint de marca numa rampa 4/8/15/30/100%, um único elemento a 100%** — "quando tudo é tingido, nada se destaca".
11. **Vidro que funciona com canvas vazio**: rim + sombra + sheen carregam a leitura; blur é bônus quando há conteúdo atrás (a falha branco-sobre-branco do Tahoe, evitada por construção).
12. **Sem linha divisória dura** entre chrome e canvas — o material é a fronteira (scroll edge effect).
13. **Grain 5–8%** via feTurbulence — premium e coerente com o traço rough.
14. **Degradação projetada**: fallback sólido bonito por si, toggle manual de transparência, reduced-motion congela o sheen — variantes desenhadas, não "efeito desligado".
15. **Hit-areas ≥ 44px** mesmo com desenho compacto em cápsulas (o vidro tende a encolher toolbars — erro documentado do próprio iOS 26).

---

## 6. Riscos e mitigação

**Legibilidade (o risco nº 1 — derrubou o default da própria Apple).** Contraste WCAG 4.5:1 não é garantível sobre backdrop arbitrário. Mitigação: calibrar tint para o pior caso (nó roxo `#EAE8FB`…`#5145B5` sob a barra); texto sobre vidro só em rótulos curtos e com peso ≥ 500; superfícies com texto denso (menus, overlay, quickPicker) em tint ≥ .55; nunca cinza-claro fino sobre vidro; scrim local se necessário. Canvas claro e controlado do app joga a favor.

**Fundo vazio.** Sobre `#FBFAF8` chapado o blur não tem o que amostrar. Mitigação já embutida no design: rim/sheen/sombra não dependem do backdrop; testar cada superfície com canvas vazio E cheio, claro E escuro.

**Performance.** Cada backdrop-filter = captura offscreen por frame durante pan/zoom, custo ∝ área×dpr²×blur. Mitigação: ≤ 4 superfícies simultâneas, todas pequenas; blur ≤ 14px no chrome, 20px só em overlays transientes; `contain: layout paint`; `.is-panning` congela o vidro se medirmos jank; refração (feImage) só em Chromium e só em superfícies de tamanho estável, mapa gerado 1× no boot.

**Fragmentação de suporte.** Refração: Chromium-only, falha silenciosa (ok por arquitetura em camadas). `prefers-reduced-transparency`: Chrome/Edge apenas → toggle manual obrigatório. `backdrop-filter` básico: universal nos navegadores atuais, mas `@supports not (backdrop-filter: blur(1px))` dá fallback sólido de graça.

**Projeção/apresentação.** Modo apresentar entra em `.reduce-glass` por padrão; vidro é ferramenta de autoria, não de palco.

**Deriva de escopo.** A tentação de "envidraçar" cards, nós ou a paleta destrói a hierarquia (e é o erro que a Apple proíbe por escrito). O mapeamento da §4 é fechado: qualquer nova superfície precisa responder "flutua sobre o canvas?" antes de receber `.glass`.

---

## 7. Referências

Fontes efetivamente abertas pelos pesquisadores:

- Apple, "Meet Liquid Glass" (WWDC25): https://developer.apple.com/videos/play/wwdc2025/219/
- Apple, "Get to know the new design system" (WWDC25): https://developer.apple.com/videos/play/wwdc2025/356/
- Apple HIG, Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple, Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- Apple Newsroom (anúncio): https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- kube.io, "Liquid Glass in CSS/SVG" (matemática da refração, squircle, limitações): https://kube.io/blog/liquid-glass-css-svg/
- Setproduct, "Liquid Glass vs Glassmorphism": https://www.setproduct.com/blog/liquid-glass-vs-glassmorphism
- LogRocket (pipeline SVG): https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/ e UX: https://blog.logrocket.com/ux-design/adopting-liquid-glass-examples-best-practices/
- webtricks.dev (stack de 4 camadas, valores): https://webtricks.dev/blog/liquid-glass-css
- Josh Comeau, backdrop-filter (extend+mask): https://www.joshwcomeau.com/css/backdrop-filter/ e sombras: https://www.joshwcomeau.com/css/designing-shadows/
- WebKit bug 245510 (Safari sem url() em backdrop-filter): https://bugs.webkit.org/show_bug.cgi?id=245510
- MDN BCD #24110 (Firefox "not planned"): https://github.com/mdn/browser-compat-data/issues/24110
- caniuse, prefers-reduced-transparency: https://caniuse.com/mdn-css_at-rules_media_prefers-reduced-transparency
- Tuts+ (variante objectBoundingBox): https://webdesign.tutsplus.com/liquid-glass-effect-svg-filters--cms-109200t
- dev.to/childrentime (encadeamento de filtros): https://dev.to/childrentime/decoding-apples-latest-liquid-glass-effect-how-to-recreate-ios-design-systems-visual-magic-with-kaj
- samasante/liquid-glass (fallback via filter: url()): https://github.com/samasante/liquid-glass
- NN/g, "Liquid Glass Is Cracked": https://www.nngroup.com/articles/liquid-glass/ e "Glassmorphism": https://www.nngroup.com/articles/glassmorphism/
- Michael Tsai, "On Liquid Glass": https://mjtsai.com/blog/2025/10/16/on-liquid-glass/ e toggle 26.1: https://mjtsai.com/blog/2025/10/21/liquid-glass-toggle-in-appleos-26-1-beta/
- Josh Cusick (decomposição em camadas): https://joshcusick.substack.com/p/apples-liquid-glass-seemed-like-a-disaster-until-i-looked-closer
- LIQUID-GLASS-GUIDE (rampas de alfa, hierarquia de raios): https://github.com/giorgio-a11y/liquid-glass-guide/blob/main/LIQUID-GLASS-GUIDE.md
- Create with Swift (comportamento adaptativo): https://www.createwithswift.com/exploring-a-new-visual-language-liquid-glass/
- paulyu.me (valores base): https://paulyu.me/articles/9

Marcados como "de memória" nos relatórios (usar com verificação se virarem decisão crítica): comportamento do `@supports` com `url()` no Safari; semântica de backdrop root/aninhamento; suporte exato de `prefers-contrast` e `@property`; ajuste "Clear/Tinted" do iOS 26.1 como setting de usuário; grain em Linear/Stripe; scroll edge effects como técnica citada no WWDC25.