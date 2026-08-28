# Evidência de certificação P07–P09

Data: 2026-08-22.  
Responsável pela execução: Cursor Agent (GPT-5.6 Sol).

## Ambiente observado

- Linux x86_64, kernel 6.12.10-76061203-generic.
- Navegador real disponível: Chromium 144.0.7559.236, embutido em
  Cursor 3.12.17 / Electron 40.10.3.
- Viewport: 1920 × 1080, DPR 1, idioma `pt-BR`.
- Aplicação servida localmente por HTTP, sem recursos de outra origem.
- `firefox`, `chromium`, `google-chrome` e NVDA não estavam disponíveis como
  executáveis independentes. O binário do Orca existe em `/usr/bin/orca`, mas
  não havia sessão assistiva humana/áudio utilizável para uma validação válida.

## Evidência automatizada

Os gates finais executados no mesmo checkout foram:

```sh
npm test
npm run check
npm run build
npm run check:freshness
node -e "const p=require('./package.json'); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1)"
```

Resultado: 141/141 testes em 15 arquivos, tipos válidos, build e freshness
verdes e zero dependências de runtime. A suíte cobre, entre outros:

- normalização/migração e limites em toda ingestão;
- storage multi-documento, falhas de quota, primeira persistência, exclusão,
  conflito dirty e eventos entre duas instâncias;
- importação que nunca sobrescreve bytes do documento ativo;
- criação conectada atômica, duplicação, drag estável, undo/redo e templates;
- falhas e limpeza dos downloads JSON/SVG/PNG, inclusive timeouts;
- export sem seleção, portas, guias, apresentação ou laser;
- subset Twemoji, checksums, símbolos deduplicados e referências internas;
- preferência de tema isolada e revelação de apresentação sem mutar o diagrama.

## Smoke real no Chromium disponível

O smoke foi executado em `http://127.0.0.1:8137/`.

- Criou um segundo documento a partir de “Anatomia completa de um app”; o
  documento vazio anterior continuou com os mesmos bytes.
- Quick create: seleção do nó, ativação da porta e escolha de “Cache” em três
  gestos; criou um nó e uma aresta, abriu o editor e aceitou “Cache rápido”.
- Undo/redo reverteu e reaplicou separadamente a criação atômica e a edição.
- Alt-arraste duplicou o nó; outro drag alterou posição mantendo a mesma
  identidade DOM durante o gesto.
- Downloads JSON, SVG e PNG chegaram aos estados “iniciado” sem erro.
- SVG gerado continha sete símbolos e sete usos para o template original,
  nenhuma referência HTTP, nenhum texto de emoji e nenhum overlay.
- O tema escuro foi persistido em `app-anatomy:theme`, sobreviveu ao reload e
  não entrou em `DiagramFile`. O SVG calculado antes/depois da troca foi
  byte a byte idêntico e permaneceu resolvido com `LIGHT_THEME`.
- Em apresentação, a área do canvas mediu 100% do viewport. Duas setas à
  direita revelaram três nós e apenas as duas arestas cujos endpoints já
  estavam visíveis. O laser apareceu somente no overlay.
- `Escape` restaurou exatamente o transform do viewport, o foco em
  `btnPresent`, o chrome, os sete nós originais da sessão de apresentação e
  removeu o laser; os bytes persistidos não mudaram.
- A emulação real de `prefers-reduced-motion: reduce` produziu duração efetiva
  de `0.00001s` para transições/animações.
- Twemoji foi inspecionado visualmente nos temas claro e escuro a 48% de zoom;
  os ícones continuaram distinguíveis. Os recursos de rede observados eram
  todos same-origin e nenhum asset Twemoji foi buscado por CDN.
- A árvore de acessibilidade expôs nomes para controles, blocos, portas,
  templates e quick picker. O fluxo principal foi exercitado por controles
  focáveis, Enter, setas e Escape.

## Limites — não certificados neste ambiente

Esta execução **não** comprova comparação visual de PNG/SVG em macOS ou
Windows, Firefox no Linux, NVDA no Windows nem leitura falada/navegação
completa pelo Orca. A árvore de acessibilidade e o smoke de teclado não
substituem uma avaliação humana com leitor de tela. A abertura pelo seletor
de arquivos nativo também não foi automatizada pelo navegador disponível;
seus caminhos de importação, normalização e preservação do documento foram
validados pela suíte Node.

Portanto, a certificação automatizável e o smoke Chromium/Linux estão
concluídos; a matriz multiplataforma e assistiva permanece como validação
manual residual, sem alegação de aprovação.

## Itens deliberadamente diferidos

Continuam fora deste escopo: CI, remoto, hosting/deploy, CSP por cabeçalhos,
PWA/offline, URL compartilhável, metadata JSON dentro do SVG, fonte manuscrita
embutida ou set autoral, e otimizações adicionais sem medição de lag.
