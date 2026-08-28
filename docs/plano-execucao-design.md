# Plano executável do design — Anatomia

**Data:** 2026-08-22  
**Fonte canônica de produto:** `docs/plano-design.md`  
**Base técnica:** `docs/plano-arquitetura.md` e `.planning/codebase/`  
**Estado:** pronto para execução, com um gate de decisão antes do pin de emojis

## 1. Estado real e ponto de partida

Este plano é um delta sobre o código atual. As Fases 1 e 2 do plano de arquitetura já estão substancialmente implementadas:

- envelope v1, `normalize()` único e aliases existem em `src/format.ts`;
- documentos independentes, migração com backup e persistência transacional existem em `src/document-storage.ts`;
- o bug de perda de dados por importação sobre a chave única está corrigido: importar cria outro documento e preserva o atual;
- persistência, histórico e mutações passam por `src/model.ts`;
- documento e overlay já são separados em `src/markup.ts`;
- rAF, rect por gesto e índice de nós já existem;
- os três templates atuais são v1;
- `src/main.ts` tem 299 linhas e é a raiz de composição;
- `public/js/` é gerado e versionado; `src/` é a fonte autoritativa;
- não há dependências de runtime.

Baseline verificado antes deste plano:

- `npm test`: 120/120;
- `npm run check`: passou;
- `npm run check:freshness`: passou;
- Git ainda não tem commits;
- `.planning/` contém somente o mapa de codebase. Não há `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` ou diretório de fases.

Por isso, este arquivo é o artefato executável apropriado agora. Não se deve fabricar uma fase GSD isolada sem os artefatos de projeto e roadmap exigidos pelo próprio fluxo GSD.

## 2. Reconciliação entre design e arquitetura

### Decisões preservadas

1. `normalize()` continua sendo a única entrada de dados.
2. Toda mudança durável continua passando por `ApplicationModel`.
3. Snapshots JSON e limite de 100 entradas continuam.
4. `documentMarkup()` continua sendo a fonte do SVG exportado.
5. Estado de seleção, portas, guias, laser e revelação não entra no arquivo nem no export.
6. Build continua com tsgo, sem bundler e sem dependências de runtime.
7. `public/js/` só é atualizado por `npm run build`.
8. Os 62 ids de blocos continuam sendo API pública.
9. Importação, criação e template só ativam outro documento após a primeira persistência bem-sucedida.

### Ajustes necessários

1. **Drag com DOM estável:** `docs/status-gate-fase-3.md` adiou o drag O(1) por falta de evidência de lentidão. O design agora traz outra evidência: portas focáveis, transições e quick create exigem que `pointermove` não substitua `innerHTML`. O trabalho é reativado como pré-requisito funcional, não como otimização especulativa.
2. **Três camadas de SVG:** manter `document` para conteúdo exportável, criar `interaction` para portas/guias/foco e manter `overlay` para preview/seleção/laser. `buildExportSvg()` continua serializando somente o documento.
3. **Coordenadas locais nos nós:** necessárias para mover o `<g>` por `transform`. A geometria pública do arquivo continua em `node.x/node.y`; só o markup interno muda.
4. **Fonte única de tema:** criar `src/theme.ts`, exigido pelo design. `catalog.ts` deixa de possuir cores literais e passa a possuir chaves semânticas.
5. **Novos módulos são permitidos apenas por fronteira concreta:** `theme.ts` para tokens puros e `canvas-renderer.ts` para patches DOM do canvas. Não criar framework, event bus ou camada genérica.
6. **`main.ts` continua composição:** listeners e coordenação permanecem nele; algoritmos puros de snap/guias ficam em `geometry.ts`, markup em `markup.ts` e patches DOM em `canvas-renderer.ts`.

### Correção de perda de dados como invariante

O bug não deve ser “corrigido de novo”. Ele vira gate de regressão em toda onda:

- importação cria documento separado;
- falha de leitura/normalização/persistência preserva o ativo;
- troca, criação e exclusão abortam quando o flush falha;
- conflito dirty entre abas não aplica last-write-wins silencioso;
- templates demorados continuam vinculados ao documento de origem.

Os testes existentes em `tests/document-storage.test.ts`, `tests/model.test.ts`, `tests/multi-document-ui.test.ts` e `tests/write-pipeline.test.ts` são obrigatórios em todas as ondas.

## 3. Dependências e ordem

```text
P00 baseline e contratos
 └─ P01 tokens, categorias e export claro
     ├─ P02 chrome mínimo e ícones de UI
     ├─ P03 renderer estável
     │   ├─ P04 paleta e empty state
     │   └─ P05 portas e quick create
     │       └─ P06 teclado, snap, guias e a11y
     └─ P07 emojis pinados
         └─ P08 dark mode e apresentação
             └─ P09 certificação
```

P02 e P03 podem ser executados em paralelo depois de P01, desde que mudanças em `public/index.html`, `public/styles.css` e `src/main.ts` sejam integradas serialmente. P04 pode começar após a API estável de P03. P07 depende da decisão de asset descrita na seção 7.

## 4. Definição de pronto comum

Cada pacote precisa:

1. editar primeiro `src/*.ts`, nunca `public/js/*.js`;
2. preservar `package.json` sem `dependencies`;
3. adicionar testes `node:test` para lógica pura e contratos de markup;
4. escapar todo valor dinâmico interpolado em HTML/SVG;
5. manter dados externos passando por `normalize()`;
6. manter estados interativos fora do SVG exportado;
7. rodar, nesta ordem:

```sh
npm test
npm run check
npm run build
npm run check:freshness
```

8. comprovar que o JavaScript gerado corresponde ao TypeScript;
9. executar o gate específico do pacote;
10. registrar qualquer golden alterado como mudança visual intencional.

Gate estrutural de zero runtime:

```sh
node -e "const p=require('./package.json'); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1)"
```

## 5. Pacotes de execução

### P00 — Congelar baseline e invariantes

**Objetivo:** impedir que o redesign reabra perda de dados, vazamento de overlay ou drift de gerados.  
**Depende de:** nada.  
**Arquivos-alvo:** `tests/multi-document-ui.test.ts`, `tests/markup.test.ts`, `tests/gesture-hygiene.test.ts`, `docs/status-gate-fase-3.md`.

Tarefas:

1. Nomear explicitamente o teste de importação como regressão do bug de sobrescrita e verificar os bytes dos dois documentos no storage, não só o estado em memória.
2. Adicionar contrato que seleção, portas, guias e apresentação são estado não serializado.
3. Atualizar `docs/status-gate-fase-3.md`: 3.5 continua bloqueado para otimização por lag, mas o subconjunto “DOM estável durante gesto” está autorizado pelo requisito funcional do design.
4. Registrar os comandos de baseline e o smoke manual mínimo antes da primeira alteração visual.

Aceite:

- dois documentos continuam legíveis depois de importar, editar, flush e alternar;
- import inválido e falha da primeira persistência mantêm documento e chave ativos;
- `buildExportSvg()` não contém classes ou atributos de porta, guia, seleção ou laser;
- 120 testes antigos continuam passando antes de adicionar novos casos.

### P01 — Tokens, categorias e export sempre claro

**Objetivo:** criar a fundação de tema sem alterar o formato v1.  
**Depende de:** P00.  
**Arquivos-alvo:** novo `src/theme.ts`, `src/types.ts`, `src/catalog.ts`, `src/markup.ts`, `src/main.ts`, `public/styles.css`, novo `tests/theme.test.ts`, `tests/catalog.test.ts`, `tests/markup.test.ts`, golden SVG.

Tarefas:

1. Definir em `theme.ts` os tokens primitivos e semânticos claros/escuros da seção 3.1 do plano de design.
2. Definir os oito pares de categoria e `catInk` por tema.
3. Trocar `Categoria.fill/stroke` por uma chave estável de categoria; não alterar ids dos 62 blocos.
4. Fazer render normal receber tema resolvido; fazer `buildExportSvg()` passar explicitamente o tema claro.
5. Aplicar tokens ao root com `data-theme="light"` desde a inicialização; não entregar toggle ainda.
6. Substituir hex dispersos em CSS/markup pelos tokens ou valores importados de `theme.ts`.
7. Adicionar teste puro de contraste WCAG: texto/fill ≥ 4,5:1 e stroke/fill ≥ 3:1 nos dois temas.

Aceite:

- `theme.ts` é a fonte dos valores de cor do canvas e export;
- `buildExportSvg(diagram)` produz os mesmos bytes com UI clara ou escura;
- `rg '#[0-9A-Fa-f]{6}' public/styles.css src/main.ts src/markup.ts src/catalog.ts` não encontra cores de produto fora de fallback explicitamente documentado;
- catálogo continua com 62 ids e aliases intactos;
- nenhum campo de tema entra em `DiagramFile`.

### P02 — Chrome mínimo, menu único e Lucide local

**Objetivo:** reduzir o chrome permanente e manter todas as ações acessíveis.  
**Depende de:** P01.  
**Arquivos-alvo:** `public/index.html`, `public/styles.css`, `src/main.ts`, `src/browser-io.ts`, `tests/multi-document-ui.test.ts`, `tests/browser-io.test.ts`, novos `public/icons/ui/*.svg`, novo `public/icons/THIRD_PARTY_NOTICES.md`.

Tarefas:

1. Copiar somente o subset necessário de Lucide para o repositório; registrar versão, URL, licença ISC e lista de arquivos.
2. Criar helper de ícone inline seguro, com `stroke="currentColor"`, caixa 20 e stroke 2.
3. Reorganizar a topbar para: marca compacta, menu Arquivo, undo, redo e Apresentar; remover subtítulo e emojis do chrome.
4. Mover novo/abrir/salvar/exportar/limpar/excluir e entrada de templates para o menu único.
5. Mover zoom para ilha inferior direita com menos, valor, mais e fit.
6. Preservar os ids públicos indispensáveis ou atualizar conscientemente o fixture de contrato e os bindings no mesmo pacote.
7. Implementar menu com `aria-expanded`, fechamento por `Escape`, clique externo e retorno de foco.

Aceite:

- no máximo seis controles de ação visíveis na topbar em repouso;
- nenhuma ação antiga desaparece;
- não há emoji em controles de chrome;
- menu e zoom são operáveis por teclado;
- `#saveStatus` continua com `aria-live`;
- limpar e excluir continuam com confirmação;
- nenhum fetch externo é feito para ícones.

### P03 — Renderer de gesto com DOM estável

**Objetivo:** evitar reconstrução total durante drag e preservar foco/transições.  
**Depende de:** P01.  
**Arquivos-alvo:** novo `src/canvas-renderer.ts`, `src/main.ts`, `src/markup.ts`, `src/geometry.ts`, `tests/markup.test.ts`, `tests/geometry.test.ts`, `tests/gesture-hygiene.test.ts`, novo `tests/canvas-renderer.test.ts`, golden SVG.

Tarefas:

1. Converter o conteúdo interno do nó para coordenadas locais e aplicar `transform="translate(x y)"` no grupo do nó.
2. Adicionar a camada `interaction` entre documento e overlay; nenhum conteúdo dela entra no export.
3. Criar `createCanvasRenderer()` com operações explícitas: render completo após commit/troca/undo, render de UI e patch de drag.
4. Em `pointermove`, atualizar o transform do nó, suas affordances e somente arestas incidentes; não atribuir `innerHTML` de document/interaction.
5. No fim do gesto, chamar `finishTransient()` e reconciliar uma vez com o estado do modelo.
6. Manter rAF, rect cacheado e pointer capture existentes.
7. Garantir cleanup correto em `pointerup`, `pointercancel` e `lostpointercapture`.

Aceite:

- teste instrumentado registra zero atribuições de `innerHTML` em `pointermove`;
- um drag gera uma entrada de undo e um agendamento de persistência;
- foco numa porta não é perdido quando o nó é movido;
- arestas incidentes acompanham o nó no mesmo frame;
- golden SVG preserva geometria visual e rough seed; qualquer mudança textual é explicada pela coordenada local;
- `documentMarkup()` continua puro e independente do DOM.

### P04 — Paleta pedagógica e empty state inline

**Objetivo:** tornar o primeiro uso autoexplicativo sem modal ou tour.  
**Depende de:** P03.  
**Arquivos-alvo:** `src/catalog.ts`, `src/markup.ts`, `src/model.ts`, `src/main.ts`, `public/index.html`, `public/styles.css`, novo `public/templates/comecar-do-zero.json`, `tests/catalog.test.ts`, `tests/templates.test.ts`, `tests/markup.test.ts`, `tests/multi-document-ui.test.ts`.

Tarefas:

1. Definir lista `ESSENTIAL_BLOCK_IDS` com cerca de dez ids existentes; não duplicar definições.
2. Renderizar “Essenciais” aberto e as oito categorias recolhidas por padrão; busca mostra apenas grupos com resultado.
3. Implementar `/` para focar busca e `Enter` para inserir o primeiro resultado pelo caminho normal do modelo. A conexão automática com a seleção será integrada em P05, depois que a operação atômica existir.
4. Criar `comecar-do-zero.json` como envelope v1 vazio e registrar o template.
5. Renderizar no canvas vazio os três cartões canônicos: Anatomia completa, O caminho de um clique e Começar do zero.
6. Desenhar as três anotações rough em markup de interação; ocultá-las quando existir o primeiro nó.
7. Tratar clique de template vazio sem confundir “novo documento vazio” com falha de export.
8. Manter “Login seguro” acessível pelo menu, embora deixe de ser um dos três cartões.

Aceite:

- primeiro uso não mostra modal;
- em repouso inicial aparecem cerca de dez blocos, não os 62;
- os três cartões desaparecem depois do primeiro nó;
- clicar em cartão cria outro documento por caminho normalizado e transacional;
- falha de template preserva o documento ativo;
- `/` e `Enter` inserem o primeiro resultado sem mouse;
- todas as strings interpoladas continuam escapadas.

### P05 — Portas modeless e quick create

**Objetivo:** concluir adicionar → conectar → renomear em até três gestos.  
**Depende de:** P03; integra com P04.  
**Arquivos-alvo:** `src/model.ts`, `src/markup.ts`, `src/geometry.ts`, `src/canvas-renderer.ts`, `src/main.ts`, `public/styles.css`, `tests/model.test.ts`, `tests/markup.test.ts`, `tests/geometry.test.ts`, `tests/gesture-hygiene.test.ts`.

Tarefas:

1. Adicionar ao modelo uma operação atômica `addConnectedNode(fromId, definitionId, x, y)` que valida capacidade, cria nó e aresta, seleciona o novo nó e gera uma única entrada de histórico.
2. Fazer criação simples retornar o id criado ou resultado explícito; não descobrir ids por leitura posterior do array.
3. Renderizar quatro portas por nó na camada de interação, sempre presentes no DOM, reveladas por `.selected`, `:hover` e `:focus-within`.
4. Arrastar porta até outro nó cria a conexão reutilizando regras do modelo; soltar fora cancela sem histórico.
5. Clicar porta abre mini-picker com Essenciais e busca; seleção chama `addConnectedNode()` e abre `openEditor()` no novo nó.
6. Integrar o `Enter` da busca da paleta: com nó selecionado, criar o primeiro resultado já conectado; sem seleção, manter a inserção simples de P04.
7. Manter `C` como atalho legado, sem botão permanente e sem depender dele para o fluxo principal.
8. Impedir loop para o próprio nó e duplicata de aresta conforme semântica atual.

Aceite:

- conexão por porta funciona por mouse e foco;
- quick create cria exatamente um nó e uma aresta em um commit;
- editor do rótulo abre no nó novo;
- `Enter` na busca insere conectado quando há seleção;
- undo remove nó e aresta juntos; redo restaura ambos;
- duplicata, nó ausente, limite de nós e limite de arestas falham sem documento parcial;
- fluxo cronometrado usa no máximo três gestos;
- portas não aparecem em JSON, SVG ou PNG exportado.

### P06 — Teclado, snap, guias e acessibilidade

**Objetivo:** oferecer equivalência de teclado e posicionamento previsível.  
**Depende de:** P05.  
**Arquivos-alvo:** `src/model.ts`, `src/geometry.ts`, `src/markup.ts`, `src/main.ts`, `public/index.html`, `public/styles.css`, `tests/model.test.ts`, `tests/geometry.test.ts`, `tests/gesture-hygiene.test.ts`, `tests/multi-document-ui.test.ts`.

Tarefas:

1. Implementar `Enter`/`F2` para renomear seleção, `Ctrl+Enter` para criar conectado à direita, `Ctrl+D` para duplicar e `Alt`-drag para duplicar antes de mover.
2. Tornar nós navegáveis por `Tab` em ordem de criação e expor nome acessível com tipo e rótulo.
3. Implementar snap de 24 px em função pura; `Alt` mantém coordenadas livres.
4. Calcular guias para centros e bordas de vizinhos em `geometry.ts`; renderizar apenas na camada de interação.
5. Implementar `?` como overlay não modal de atalhos, com `Escape`, foco inicial e retorno.
6. Implementar `Ctrl+.` para recolher/restaurar chrome.
7. Aplicar `:focus-visible` universal com `--accent`.
8. Anunciar criação, conexão, exclusão e falha relevante por região live sem substituir mensagens de conflito de storage.

Aceite:

- criar, conectar e renomear é possível sem mouse;
- `Tab` visita cada nó uma vez na ordem do array;
- snap produz múltiplos de 24 e `Alt` preserva a coordenada;
- guias aparecem somente durante drag e nunca no export;
- atalhos não disparam dentro de input/select/contenteditable;
- contraste do foco é mensurável e o foco não desaparece durante drag;
- conflito dirty continua tendo prioridade no status.

### P07 — Emoji pinado e export determinístico

**Objetivo:** remover dependência da fonte emoji do sistema.  
**Depende de:** P01 e gate de decisão de assets.  
**Arquivos-alvo:** `src/catalog.ts`, `src/theme.ts`, `src/markup.ts`, novos `public/icons/catalog/*.svg` ou sprite equivalente, `public/icons/THIRD_PARTY_NOTICES.md`, `tests/catalog.test.ts`, `tests/markup.test.ts`, `tests/templates.test.ts`, golden SVG.

Tarefas:

1. Fixar fornecedor, versão/tag, licença, URL e checksum do conjunto de origem.
2. Copiar somente os glifos usados pelo catálogo e categorias; nenhum script de runtime ou CDN.
3. Mapear cada bloco para `iconId` estável e gerar `<symbol>`/`<use>` de forma serializável no SVG.
4. Incluir defs usados no export; evitar referências a arquivos externos no SVG final.
5. Auditar semanticamente `k8s`, `navegador`, `atacante` e sequências ZWJ.
6. Incrementar `CATALOG_VERSION` porque a representação pública visual muda, sem alterar ids de bloco.
7. Atualizar golden somente após inspeção do SVG final.

Aceite:

- não existe `<text>` de emoji em node markup;
- SVG exportado contém todos os símbolos necessários e nenhuma URL externa;
- `👩‍💻`, `🕵️` e `☸️` têm um asset único e reproduzível;
- comparação visual registrada em Linux, macOS e Windows para PNG e SVG;
- assets continuam legíveis a 50% de zoom e nos dois temas;
- licenças/atribuições acompanham o artefato publicado.

### P08 — Dark mode e modo Apresentar

**Objetivo:** colher a fundação de tokens e transformar o diagrama em material de aula.  
**Depende de:** P06 e P07.  
**Arquivos-alvo:** `src/theme.ts`, `src/model.ts` apenas se necessário para preferência não documental, `src/markup.ts`, `src/canvas-renderer.ts`, `src/main.ts`, `public/index.html`, `public/styles.css`, `tests/theme.test.ts`, `tests/markup.test.ts`, `tests/gesture-hygiene.test.ts`, `tests/multi-document-ui.test.ts`.

Tarefas:

1. Adicionar toggle claro/escuro com preferência em chave própria de localStorage; nunca em `DiagramFile`.
2. Aplicar transição de 150 ms, respeitando `prefers-reduced-motion`.
3. Manter export resolvido sempre com `LIGHT_THEME`.
4. Implementar estado de apresentação somente na UI: chrome oculto, fit automático, entrada/saída idempotente e `Esc`.
5. Revelar nós por ordem do array com `←`/`→`; mostrar aresta somente quando seus endpoints estiverem revelados.
6. Implementar laser pointer na camada overlay, sem persistência, história ou export.
7. Restaurar viewport, foco e chrome ao sair.

Aceite:

- preferência de tema sobrevive a reload, mas export SVG é byte a byte igual nos dois temas;
- apresentação ocupa pelo menos 95% da área com canvas;
- `Esc` restaura viewport, foco e controles;
- revelação segue ordem de criação e não altera `nodes`/`edges`;
- laser não aparece no export;
- animações são desativadas/reduzidas quando solicitado pelo sistema.

### P09 — Certificação integrada

**Objetivo:** fechar a entrega com gates automatizados e evidência manual.  
**Depende de:** P00–P08.  
**Arquivos-alvo:** `docs/status-gate-fase-3.md`, `docs/entrega-diferida.md`, `README.md`, possível novo `docs/evidencia-design.md`; código somente para corrigir falhas encontradas.

Tarefas:

1. Rodar todos os gates comuns em checkout local consistente.
2. Executar smoke de criar, conectar, mover, editar, duplicar, desfazer/refazer, salvar, abrir, alternar documentos, templates e exportar.
3. Repetir cenários de falha de storage/import/template e conflito dirty em duas abas.
4. Validar teclado completo e leitor de tela pelo menos em Chromium + NVDA/Orca; registrar limitações reais.
5. Validar visual/emoji/export em Chromium e Firefox no Linux e registrar comparação de macOS/Windows.
6. Medir fluxo quick create e área do modo apresentação.
7. Atualizar contagem real de testes no README; não manter “120” se a suíte crescer.
8. Registrar o que continua diferido: CI, hosting, PWA, URL compartilhável, metadata SVG e fonte manuscrita/set autoral.

Aceite:

- todos os gates automatizados passam;
- nenhum cenário de redesign sobrescreve outro documento;
- não há dependência de runtime, CDN, bundler ou fetch externo de assets;
- evidência manual contém ambiente, navegador, data, resultado e responsável;
- pendências condicionais continuam explicitamente fora do escopo.

## 6. Gates verificáveis por onda

### Onda A — P00/P01

- formato v1 e storage sem regressão;
- tokens e contrastes aprovados;
- export claro determinístico;
- nenhum id de catálogo alterado.

### Onda B — P02/P03

- todas as ações antigas alcançáveis;
- zero `innerHTML` de documento/interação em `pointermove`;
- foco sobrevive ao gesto;
- golden e export sem affordances.

### Onda C — P04/P05

- empty state e paleta sem modal;
- quick create em até três gestos;
- operação conectada atômica e reversível;
- falhas não deixam nó/aresta parciais.

### Onda D — P06/P07

- fluxo central 100% por teclado;
- snap/guias sem vazamento no export;
- assets locais licenciados;
- PNG/SVG comparados entre plataformas.

### Onda E — P08/P09

- export idêntico entre temas;
- apresentação sem mutar documento;
- smoke completo de persistência e duas abas;
- todos os comandos comuns verdes.

Um gate vermelho bloqueia a próxima onda. Não aceitar override para perda de dados, ingestão fora de `normalize()`, overlay no export, dependência de runtime ou `public/js` stale.

## 7. Decisão bloqueante

O plano canônico permite **Twemoji (CC-BY)** ou **Noto Emoji (Apache-2.0)**, mas não escolhe um. Essa escolha afeta arquivos, atribuição, pipeline de aquisição e aparência; não deve ser inventada durante execução.

Antes de P07, o responsável precisa registrar uma opção:

1. **Twemoji:** aparência conhecida e colorida; exige atribuição CC-BY.
2. **Noto Emoji:** licença Apache-2.0; aparência diferente e conjunto de origem diferente.

Até essa decisão, P00–P06 podem avançar. P07–P09 ficam bloqueados.

## 8. Riscos e mitigação

1. **Golden muda em massa por coordenadas locais.** Separar mudança estrutural de mudança visual; provar equivalência geométrica antes de aceitar novo golden.
2. **`main.ts` cresce além da função de composição.** Manter patches DOM em `canvas-renderer.ts` e cálculos em módulos puros.
3. **Portas entram no export.** Camada interaction separada e teste negativo de SVG/PNG.
4. **Dark mode contamina export.** `buildExportSvg()` recebe `LIGHT_THEME`, nunca lê `document.documentElement`.
5. **Quick create cria estado parcial.** Uma operação atômica no modelo, com teste de limites/falhas e um snapshot.
6. **Assets aumentam muito o repositório.** Copiar somente glifos usados, registrar checksum e proibir pacote npm/runtime.
7. **Atalhos quebram digitação.** Reusar `isTextEntryTarget()` e testar inputs, selects e contenteditable.
8. **Mudanças de HTML quebram bindings.** Atualizar fixture de ids e bindings no mesmo pacote.
9. **Redesign reabre perda de dados.** Gate de regressão obrigatório em toda onda.
10. **Validação só em Node dá falso conforto.** P09 exige smoke real de browser, foco, pointer capture, downloads e duas abas.

## 9. Fora de escopo

- CI, remoto, provedor e deploy;
- service worker/PWA;
- URL compartilhável;
- metadata JSON dentro de SVG;
- fonte manuscrita, até teste completo de diacríticos PT-BR;
- set autoral rough para Essenciais;
- colaboração, CRDT, IndexedDB, framework ou plugin system;
- otimizações além do DOM estável e arestas incidentes necessárias ao gesto.

## 10. Próxima ação

Executar P00 primeiro. Se o projeto for formalizado em GSD antes disso, usar este documento como fonte de requisitos ao criar `PROJECT.md`, `REQUIREMENTS.md` e `ROADMAP.md`, e então decompor P00–P09 em fases/PLAN.md sem alterar a ordem de dependências nem os gates acima.
