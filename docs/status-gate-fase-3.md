<!-- generated-by: gsd-doc-writer -->
# Status do gate da Fase 3

Data da revisão: 2026-08-22.

## Decisão

**Fase 3 continua bloqueada para os itens condicionais 3.1–3.4 e para otimização motivada por lag.** O subconjunto de 3.5 “DOM estável durante gesto” foi autorizado pelo requisito funcional do design: portas focáveis, transições, guias e quick create não podem sobreviver a reconstruções de `innerHTML` em cada `pointermove`. Essa autorização não é evidência de lentidão e não libera outras otimizações.

Esta decisão não transforma propostas, riscos previstos ou capacidades futuras em evidência de necessidade.

## Pré-requisitos observados

Já existem:

- envelope v1 e ingestão JSON por `normalize()` em `src/format.ts`;
- stores e históricos independentes por documento, snapshots públicos imutáveis e `ui-only` impedindo mutação documental também em runtime;
- normalização integral da criação pública e primeira persistência transacional antes de ativar documentos novos, importados ou criados de modelos;
- matriz externa ativa/inativa completa: caches limpos atualizam ou são aposentados, caches dirty preservam estado/histórico como conflito, e eventos sem cache atualizam/removem apenas o registro sem trocar o ativo;
- na exclusão ativa limpa, fallback limpo recarrega bytes persistidos atuais, fallback dirty preserva histórico, e falha ao persistir substituto mantém recuperação ready/dirty para flush posterior;
- browser IO injetável retorna falhas explícitas;
- geometria e markup puros, camadas de documento/overlay e templates com remapeamento;
- 141 testes `node:test` em 15 arquivos, incluindo formato, storage, modelo, browser IO, lifecycle, tema, renderer, Twemoji e contratos comportamentais;
- golden SVG e teste que exclui estado efêmero do export;
- `geometry.ts` e `markup.ts` sem import de `model.ts` nem acesso a globals de aplicação.
- renderer com camadas `document`, `interaction` e `overlay`; o patch de drag altera o `transform` do nó, portas e arestas incidentes sem atribuir `innerHTML` às camadas de documento/interação;
- `npm test` (141/141), `npm run check`, build, `npm run check:freshness` e gate de zero dependências executados com sucesso nesta revisão;
- timeout padrão de 10 segundos para imagem/`toBlob()` do PNG, com cancelamento, revogação única da URL e callbacks tardios ignorados.
- Twemoji v17.0.3 pinado em subset local de 65 símbolos, com CC-BY 4.0,
  checksums da fonte e do sprite e export com `<symbol>/<use>` interno;
- tema escuro persistente fora de `DiagramFile`, export sempre claro e modo
  Apresentar com revelação, laser e restauração de viewport/foco;
- smoke real Chromium/Linux de criação, quick create, edição, duplicação,
  drag, undo/redo, documentos independentes, templates e downloads JSON/SVG/PNG,
  detalhado em `docs/evidencia-design.md`.

Ainda falta para a matriz manual multiplataforma/assistiva:

- comparar PNG/SVG visualmente em macOS e Windows e executar Firefox no Linux;
- validar leitura falada e navegação humana com NVDA e Orca;
- abrir pelo seletor de arquivo nativo em uma sessão manual. A importação,
  falhas/offline, pointer cancelado/captura perdida, storage, conflito entre abas
  e timeouts permanecem cobertos de forma automatizada, não por alegação manual.

Os riscos técnicos residuais imediatos são baixos: reserva/recuperação de ID entre abas usa Web Storage sem compare-and-set, a suíte Node e o Chromium disponível não substituem validação manual multiplataforma/assistiva, e uma exclusão inativa pode produzir texto de status que parece referir-se ao documento ativo apesar de o estado ativo permanecer correto.

## Gatilhos e critérios de ativação

### 3.1 — SVG autocontido: adiado

- **Evidência presente:** export JSON/SVG/PNG existe; há golden do SVG e a fronteira `browser-io.ts` cobre falhas e limites de raster. Isso prova capacidade, não circulação de imagens.
- **Evidência exigida:** relato de uso real identificando imagens exportadas sendo trocadas entre instrutor e alunos, ou artefatos de uma aula que demonstrem esse fluxo.
- **Aceitação quando ativado:** SVG exportado contém JSON v1 normalizado em `<metadata>`; abrir `.svg` encaminha o conteúdo extraído exclusivamente a `normalize()`; exportar e reimportar resulta em documento semanticamente idêntico; entradas malformadas preservam o documento ativo.

### 3.2 — Fontes: adiado

- **Evidência presente:** o SVG usa fallbacks de sistema e o risco em Linux/Android está documentado. Risco conhecido não é validação de uma solução.
- **Evidência exigida:** 3.1 ativado e resultado comparativo registrado em Linux e Android que permita escolher entre WOFF2 embutido e fallback documentado.
- **Aceitação quando ativado:** diacríticos PT-BR e layout são validados nos dois ambientes; a decisão e o fallback ficam documentados; PNG continua sendo o formato oficial até essa validação.

### 3.3 — URL `#d=`: adiado

- **Evidência presente:** `normalize()` já é o funil de ingestão. Não há relato de alunos consumindo diagramas compartilhados.
- **Evidência exigida:** relato de uma aula real em que alunos precisem receber/abrir diagramas e em que o compartilhamento por arquivo seja uma fricção concreta.
- **Aceitação quando ativado:** round-trip por compressão/base64url é semanticamente idêntico; todo decode passa por `normalize()`; payload inválido não substitui o documento ativo; limite explícito de URL aciona fallback por arquivo.

### 3.4 — PWA: adiado

- **Evidência presente:** os assets atuais não dependem de serviço remoto após carregados. Não há relato de indisponibilidade de rede em aula.
- **Evidência exigida:** ocorrência ou requisito de aula registrado que demonstre necessidade de abrir/recarregar o app sem conexão.
- **Aceitação quando ativado:** instalação versionada do service worker, atualização visível, uso offline testado e teste de upgrade comprovando que cache antigo não mantém uma versão obsoleta.

### 3.5 — Otimização por lag adiada; DOM estável autorizado

- **Evidência presente:** rAF, rect por gesto e índice `Map` já existiam. O design adicionou uma necessidade funcional independente de performance: preservar identidade/foco das portas e permitir patches de guias e quick create durante o gesto.
- **Evidência exigida:** medição reproduzível no hardware de aula, registrando dispositivo, navegador, tamanho do diagrama e degradação observada durante drag.
- **Aceitação do subconjunto entregue:** coordenadas locais/`transform`, somente arestas incidentes recalculadas, zero atribuições de `innerHTML` em `pointermove`, foco do nó preservado e fingerprint golden atualizado como mudança estrutural intencional.
- **O que continua bloqueado:** qualquer otimização adicional baseada em suposta lentidão ainda exige medição reproduzível no hardware de aula.

## Baseline e smoke mínimo do redesign

Antes da alteração visual, o baseline registrado era `npm test` 120/120, `npm run check` verde, `npm run build` verde e `npm run check:freshness` verde. O smoke mínimo definido para a integração P00–P06 é:

1. criar um documento, importar outro, editar, flush, alternar e conferir os bytes independentes;
2. criar, conectar por porta, mover com snap/Alt, renomear e desfazer/refazer;
3. criar por template vazio e não vazio, mantendo o documento de origem em falha;
4. exportar JSON/SVG/PNG e confirmar ausência de seleção, portas, guias e estado de apresentação;
5. navegar por teclado, abrir/fechar menu e ajuda, recolher o chrome e confirmar retorno de foco.

Os contratos automatizados cobrem as invariantes acima. A certificação P09
automatizável e o smoke Chromium/Linux foram executados após a escolha de
Twemoji; somente a matriz manual residual descrita em `docs/evidencia-design.md`
permanece sem comprovação neste ambiente.

## Paralelismo e conflitos

- 3.1, 3.3 e o arquivo isolado de 3.4 podem ser desenvolvidos em paralelo somente após seus próprios gatilhos e o gate da Fase 2.
- Alterações em `src/format.ts`, `src/main.ts` e `public/index.html` entram por merges seriais, com um único integrador.
- 3.2 sucede 3.1.
- 3.5 é exclusiva da trilha de render/gestos e não deve ser combinada com outra mudança nessa trilha.
- Cada integração preserva ingestão exclusiva por `normalize()`, export sem overlay e golden SVG; geração de `public/js/` ocorre uma única vez após o merge serial.
