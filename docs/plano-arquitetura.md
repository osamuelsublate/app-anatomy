# PLANO DE ARQUITETURA CONSENSUAL — Anatomia (construtor de diagramas)

## 1. Princípios acordados

Os cinco debatedores convergiram nos seguintes princípios, que passam a ser régua para qualquer proposta futura:

1. **Zero dependências de runtime e build com tsgo são ativos, não dívida.** O deploy é `cp -r public/` para qualquer host estático; o build é subsegundo. Toda proposta que adicione dependência de runtime ou passo de build precisa provar ganho medido.
2. **O contrato mais importante é o arquivo, não a API interna.** Arquivos JSON de aula vão circular entre máquinas e sobreviver a refactors. Envelope versionado antes de qualquer reestruturação de código ("refatorar sem formato é refatorar sobre areia").
3. **Toda ingestão de dados passa por um único `normalize()`.** localStorage, import de JSON, seed, templates, futuro `#d=`: um só loader/validador. Hoje há 3 pontos de ingestão; o roadmap cria ~6 — sem funil único, nascem seis parsers.
4. **Um único caminho de escrita no estado.** O `commit()` da Estado e o `update()` da Modularidade são o mesmo mecanismo com dois nomes; entra **um só**, com três modos: transiente (drag: renderiza, não persiste, não gera história), commitado (persiste debounced + entrada de história) e persist-only. Isso elimina os bypasses de `innerHTML` (main.ts:472, 483) pela raiz — a causa é `persist()` dentro de `render()` (main.ts:227).
5. **Snapshots JSON para undo/redo ficam.** Medido: ~10KB por snapshot, ~1MB para 100 entradas no pior caso realista. Command-pattern é abstração sem caso de uso. O que muda é a assinatura (`commit(before)`), que corrige dois bugs reais.
6. **Otimização só com dor medida — exceto erros de classe.** Coalescer pointermove em rAF, cachear o rect do canvas no pointerdown e `Map` de nós não são micro-otimização: são correções de taxa de eventos (mouse a 500–1000Hz) e de reflow síncrono write-then-read. Entram sem benchmark. Todo o resto (render keyed, camadas, coordenadas locais) espera dor real.
7. **Um único pipeline de desenho.** O export SVG reusa `worldMarkup` — "o que se vê é o que se exporta" é garantia de produto. Qualquer mudança de render preserva essa paridade.
8. **Ids do catálogo são API pública.** Rename de id de bloco é breaking change; o desarme é tabela de aliases no `normalize()`, não reescrita.
9. **Testes com `node:test`, zero deps, sobre módulos puros.** Pré-condição: markup e geometria recebem estado por parâmetro (hoje leem globals de módulo — main.ts:169-172, 202-205), senão nada roda em Node.

### Divergências que restaram e a decisão do moderador

| Divergência | Posições | Decisão | Porquê |
|---|---|---|---|
| **Bancada de benchmark agora** | Performance: sim (meio dia); Produto e Pragmático: não | **Não agora.** Reabrir só se houver lentidão percebida em aula | O alvo real é 10–40 nós; o gate de 300 nós nunca abriria. As higienes sem-benchmark já entram; o resto fica no registro de não-fazer condicional |
| **Service worker / PWA** | Produto: sim (~60 linhas, aula offline); Pragmático: footgun de cache velho ao vivo | **Deploy estático já; SW adiado para Fase 3, condicionado a necessidade offline real** | O risco de servir versão velha durante aula supera o ganho hipotético; deploy estático entrega 80% da distribuição |
| **Overlay de camadas (doc/efêmero)** | Performance e Modularidade: sim; Pragmático: adiar | **Fase 2, junto da extração de markup** | Três beneficiários com uma mudança: purifica `nodeMarkup` (remove `connectFrom` de dentro), restaura seleção no undo, e substitui o boolean `forExport` |
| **Envelope gordo vs. mínimo** | Estado: `catalogVersion`/`savedAt`; Pragmático: interseção mínima | **`{format:"anatomia", version:1, meta:{title, savedAt?, catalogVersion?}, nodes, edges}`** — escrita grava tudo, leitura só exige `version`/`nodes`/`edges` | Escrita rica custa zero; leitura tolerante (Postel) evita rejeitar arquivos válidos |
| **Extensão do split de módulos** | Modularidade: 7 módulos; Pragmático: 2-3 | **5 arquivos: `format.ts`, `geometry.ts`, `markup.ts`, `model.ts` (store+história), e main.ts como fiação (~200-250 linhas)** | Corte pelas costuras testáveis; `palette.ts`/`viewport.ts` separados é navegação sem benefício para um mantenedor |
| **`catHint` para def desconhecido** | Produto sugeriu; Estado corrigiu factualmente | **Não.** Def desconhecido já preserva label/x/y no round-trip; só degrada o render para "❓" | O risco real é rename de id, coberto por aliases |
| **Coordenadas locais + drag O(1)** | Performance: no PR da extração; Pragmático: nunca sem gate | **Fase 3 condicional**, mas `markup.ts` nasce puro para não bloquear | São ~60-80 linhas que tocam o mesmo código; se a dor aparecer, o jitter do rough.ts (semeado só por id) garante traço bit a bit idêntico |

## 2. Arquitetura-alvo

### Módulos e fronteiras

```
src/
  types.ts       — DiagNode, DiagEdge, Diagram, DiagramFile (envelope v1)
  catalog.ts     — 62 blocos + CATALOG_VERSION + ALIASES (deprecações de id)
  rough.ts       — inalterado (já é puro, semeado por id)
  format.ts      — normalize(unknown) -> Diagram | erro; migrações; único
                   ponto de ingestão (localStorage, import, seed, templates,
                   futuro #d=, futuro import de .svg)
  geometry.ts    — anchorOnRect, wrapLabel, diagramBounds(d, margem)
                   (mata a duplicação fitView/buildExportSVG); puro
  markup.ts      — nodeMarkup(node), edgeMarkup(edge, nodeIndex),
                   worldMarkup(diagram) — SEM estado efêmero, SEM globals;
                   overlayMarkup(selection, connectFrom, connectCursor) à parte
  model.ts       — store único: estado doc + ui separados;
                   update(fn, {mode: "transient" | "commit" | "silent"});
                   história por snapshot com commit(before); Map de nós
                   derivado; persist debounced (com flush em pagehide)
  main.ts        — fiação DOM: listeners, paleta, toolbar, editor de rótulo,
                   pan/zoom, export. Nenhuma regra de negócio.
test/            — node:test sobre format, geometry, model (história incluída)
```

Regras de fronteira: funções e parâmetros — **sem** classes, DI, event bus ou plugins. `markup.ts` e `geometry.ts` não importam `model.ts`. `format.ts` é o único que conhece versões antigas.

### Modelo de dados e formato de arquivo (schema v1)

```json
{
  "format": "anatomia",
  "version": 1,
  "meta": { "title": "Aula 3 — API e banco", "savedAt": "…", "catalogVersion": "…" },
  "nodes": [ { "id": "…", "def": "api", "x": 120, "y": 80, "label": "…" } ],
  "edges": [ { "id": "…", "from": "…", "to": "…", "label": "" } ]
}
```

`normalize()` — validação **por item**, nunca tudo-ou-nada:
- arquivo sem `version` → tratado como v0 (formato atual `{nodes, edges}`) e migrado;
- nó sem `x`/`y` numérico → descartado com aviso (hoje vira `NaN` no path);
- aresta com endpoint inexistente → descartada (hoje vira `""` no render mas **sobrevive e exporta** — main.ts:184, lixo invisível);
- `def` desconhecido → **preservado** (render degrada para "❓", dados intactos);
- `def` renomeado → traduzido pela tabela de aliases do catalog.ts;
- inserção de template em diagrama existente → **remap de ids** obrigatório (o `uid()` de ~41 bits colide silenciosamente).

### Estado e undo/redo

- Estado dividido em `doc` (Diagram — serializado, versionado) e `ui` (seleção, connectFrom, viewport — nunca persiste no arquivo).
- História por **snapshot JSON**, cap 100. API: captura-se `before` no início do gesto e `commit(before)` no fim — isso elimina a reimplementação inline do pointerup (main.ts:489-493) e o push no-op do `commitEditor` (main.ts:387, que empilha entrada mesmo sem mudança).
- Updates transientes (cada pointermove do drag) renderizam sem persistir nem empilhar; o gesto vira **uma** entrada no pointerup.
- Persist: debounce ~500ms + **flush obrigatório em `pagehide`/`visibilitychange`** (janela de perda apontada pelo Performance).

### Estratégia de render

- **Mantém-se `innerHTML` total da cena** — código correto mais simples na escala real (10–40 nós, 2–4ms).
- **Duas camadas**: `<g id="doc">` = f(diagram) e `<g id="overlay">` = f(ui). Seleção e preview de conexão redesenham só o overlay; o boolean `forExport` desaparece (export serializa só o `<g>` de doc).
- Higiene incondicional: redraws de gesto coalescidos em rAF; rect do canvas cacheado no pointerdown; `Map<id, node>` para lookup (hoje `Array.find` O(N) 2× por aresta).
- Render keyed / coordenadas locais / drag O(1): **registro de não-fazer condicional** — só se houver lag percebido em hardware de aula.

## 3. Roteiro em 3 fases

### Fase 1 — Destrava o curso (correção de perda de dados + formato)

| # | O quê | Por quê | Arquivos | Esforço |
|---|---|---|---|---|
| 1.1 | **`format.ts` + envelope v1 + `normalize()`** por toda ingestão (localStorage main.ts:118, importJSON main.ts:666, seed) | Contrato estável antes de qualquer refactor; descarta arestas penduradas e nós inválidos; migra v0; aliases de def | novo `format.ts`, `types.ts`, main.ts | **M** (1 dia) |
| 1.2 | **Multi-documento no localStorage** + título no topbar + seletor | **Bug mais grave do app**: `importJSON → render() → persist()` sobre chave única sobrescreve o autosave de outra aula. Perda de dados real, hoje | main.ts, index.html, styles.css | **M** |
| 1.3 | **`persist()` fora do `render()`**, debounced, flush em pagehide | Causa raiz dos bypasses de innerHTML e do clobbering | main.ts (depois model.ts) | **P** |
| 1.4 | **Correções de história**: `commit(before)`; sem push no-op no `commitEditor`; unificar trilha do pointerup | Dois bugs confirmados por três debatedores | main.ts | **P** (meio dia) |
| 1.5 | **Higiene de gesto**: rAF no pointermove, rect cacheado, Map de nós | Erro de classe (taxa de eventos + reflow forçado), ~35 linhas | main.ts | **P** |
| 1.6 | **Deploy estático** (GitHub Pages ou equivalente), sem SW | Distribuição pronta; zero-build já pagou | infra | **P** (1h) |

### Fase 2 — Qualidade estrutural

| # | O quê | Por quê | Arquivos | Esforço |
|---|---|---|---|---|
| 2.1 | **Extração de módulos**: `geometry.ts`, `markup.ts` (estado por parâmetro, zero globals), `model.ts` com store único de 3 modos; main.ts vira fiação | Destrava teste em Node; um caminho de escrita; funde Estado-P3/Modularidade-P2/Pragmático numa função só | todos em src/ | **M–G** (2-3 dias) |
| 2.2 | **Overlay doc/efêmero** (dois `<g>`) | Purifica markup, seleção sobrevive ao undo, mata `forExport`; pré-requisito barato de qualquer evolução de render | markup.ts, main.ts | **P–M** |
| 2.3 | **Testes `node:test`** sobre format/geometry/model | Rede de segurança para todo o roadmap; zero deps | test/ | **M** |
| 2.4 | **`diagramBounds()` unificado** para fitView e export | Mata duplicação existente | geometry.ts | **P** |
| 2.5 | **Templates por aula**: `public/templates/*.json` (formato v1) + "Novo a partir de…"; `seedExample()` vira primeiro template; remap de ids ao inserir | Destrava a produção do curso diretamente; depende de 1.1/1.2 | main.ts, format.ts, public/ | **M** |

### Fase 3 — Evoluções maiores (cada uma com gatilho explícito)

| # | O quê | Gatilho | Esforço |
|---|---|---|---|
| 3.1 | **Exports auto-contidos**: JSON em `<metadata>` do SVG; `importJSON` aceita `.svg`; depois tEXt no PNG | Imagens circulando entre instrutor/alunos | **M** |
| 3.2 | **Decisão de fontes no SVG**: woff2 embutido ou rebaixamento documentado (`Comic Sans MS` não existe em Linux/Android — main.ts:8-9); até lá, **PNG é o formato oficial de circulação** | Junto de 3.1 | **P–M** |
| 3.3 | **URL compartilhável `#d=`** com `CompressionStream` + base64url, entrando pelo `normalize()` | Alunos consumindo diagramas viram realidade | **M** |
| 3.4 | **PWA/SW cache-first** | Necessidade offline comprovada em aula; exige disciplina de versionamento de cache | **M** |
| 3.5 | **Coordenadas locais + translate + re-path incidente** (drag O(1)); mini-medição antes no hardware de aula | Lag percebido arrastando | **M** |

## 4. Explicitamente REJEITADO (não rediscutir sem fato novo)

- **Canvas2D/WebGL**: reimplementaria picking, wrap de texto e export vetorial, quebrando a paridade ver=exportar. Proponente retirou.
- **Quadtree, culling, virtualização**: <300 nós jamais justifica índice espacial.
- **Command-pattern / event sourcing para undo**: snapshots cabem em ~1MB no pior caso; abstração sem carga.
- **CRDT / colaboração**: o barato já está garantido (ids estáveis, doc/ui separados); o resto é especulação.
- **IndexedDB, zod ou qualquer validador de dependência**: `normalize()` de ~40 linhas cobre o schema v1.
- **Catálogo como JSON fetchado**: troca validação em compile-time (tsgo quebra o build em id duplicado) por validador runtime + init assíncrono + segundo artefato versionado, para economizar um build de subsegundo cujo único usuário é o dev. Rejeição unânime, incluindo a proponente. Catálogo por curso, se vier, entra no envelope de template.
- **Sistema de plugins/temas**: sem segundo autor de blocos.
- **Framework / lit-html / qualquer dep de runtime**: innerHTML total é o código correto mais simples na escala alvo; lit-html só reabriria se uma medição futura reprovasse a solução própria.
- **Export/import `.excalidraw`**: mapeamento lossy nas duas direções (`def`, cor por categoria, emoji sem correspondente); manutenção eterna. O `<metadata>` no SVG (3.1) entrega a interoperabilidade que importa.
- **Bancada de benchmark de 300 nós agora**: mede cenário que nenhuma aula produz.
- **Coalescência de história com `coalesceKey`**: rótulo já gera uma entrada por edição (push só no blur/Enter); motor para carga que não há.

## 5. Riscos e mitigação

1. **Refactor da Fase 2 quebra comportamento visual.** Mitigação: testes da Fase 2.3 antes de mexer em markup; o jitter do rough.ts é determinístico por id — qualquer mudança de coordenadas pode ser verificada por comparação de string do SVG exportado (golden test barato, sem dep).
2. **Migração v0→v1 corrompe autosaves existentes.** Mitigação: `normalize()` nunca descarta o documento inteiro (validação por item); manter cópia do valor bruto antigo em chave `backup-v0` no localStorage na primeira migração.
3. **Debounce de persist perde dados ao fechar aba.** Mitigação já no plano: flush em `pagehide`/`visibilitychange` é parte da definição de pronto do item 1.3, não opcional.
4. **Dois mecanismos de escrita renascem** (histórico do debate mostra três donos do mesmo diff). Mitigação: o store de 2.1 tem **um dono de implementação**; PRs que chamem `render()` ou `persist()` fora do store são rejeitados por convenção escrita no README.
5. **Drag transiente vira bypass de novo.** Mitigação: o modo `transient` é conceito de primeira classe na API do store — o caso drag está especificado no design, não improvisado.
6. **Colisão de ids ao inserir templates.** Mitigação: remap de ids no `normalize({intoExisting})` é obrigatório desde 2.5; `uid()` atual (Math.random, ~41 bits) permanece aceitável só porque o remap existe.
7. **SVG renderiza diferente na máquina do aluno** (fontes de sistema). Mitigação: PNG como formato oficial de circulação até 3.2 decidir fontes; documentar no UI de export.
8. **Escopo cresce e o arquivo único vira 1500 linhas antes da Fase 2.** Mitigação: a ordem das fases é contratual — nenhum item da Fase 3 começa antes de 2.1–2.3 concluídos.
9. **tsgo (preview) muda comportamento.** Mitigação: pin de versão no package.json; o código não usa nada além de TS padrão + ES modules, então o fallback para `tsc` é trivial e não viola a restrição em espírito (build simples, sem bundler).

**Restrição dura preservada**: tudo acima compila com tsgo, sem bundler, sem dependência de runtime; as únicas adições são arquivos TS, JSONs estáticos em `public/` e (na Fase 3, se justificado) APIs nativas do navegador (`CompressionStream`, service worker).