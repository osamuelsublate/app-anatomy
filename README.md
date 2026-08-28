<!-- generated-by: gsd-doc-writer -->
# Anatomia

Construtor visual, sem dependências de runtime, para criar diagramas que explicam a anatomia de aplicações. O app roda como site estático, mantém vários documentos no navegador e permite importar, salvar e exportar diagramas.

## Desenvolvimento local

Requer Node.js 18 ou mais recente com npm e Python 3 para o servidor estático. O pacote é privado e usa apenas dependências de desenvolvimento; o app continua sem dependências de runtime.

```sh
npm ci             # instala as dependências de desenvolvimento
npm test           # compila e executa os 141 testes node:test
npm run check      # valida os tipos sem gerar arquivos
npm run build      # compila src/ para public/js/
npm run check:freshness # verifica se public/js corresponde a src/ sem alterá-lo
npm run serve      # serve public/ em http://localhost:8137/
```

`src/` é a fonte autoritativa. `public/js/` é JavaScript gerado e versionado para permitir publicação estática: nunca o edite manualmente e sempre rode `npm run build` após alterar TypeScript. Os comandos de build e testes removem seus diretórios de saída antes de compilar, evitando artefatos órfãos. `npm run check:freshness` faz uma compilação temporária, compara todos os módulos com `public/js/` e remove o temporário; o check passa no estado atual, mas não substitui nem configura CI. O artefato publicável é somente o conteúdo de `public/`.

## Formato e documentos

Arquivos atuais usam o envelope v1:

```json
{"format":"anatomia","version":1,"meta":{"title":"Meu diagrama"},"nodes":[],"edges":[]}
```

Arquivos legados v0 (`{nodes, edges}`) são migrados por `normalize()`. Toda ingestão — armazenamento local, JSON, templates e a API pública de criação — passa por `normalize()` antes de ativar um documento. O navegador mantém cada documento em uma chave própria e um store por documento durante a sessão, incluindo histórico e alterações ainda não salvas; importar cria um novo documento e não sobrescreve o ativo. A primeira migração do armazenamento legado preserva uma cópia bruta de segurança.

Criação, importação e “novo a partir de modelo” só ativam o novo store depois que o primeiro documento e o ponteiro ativo foram persistidos. Se essa primeira persistência falhar, a reserva é limpa, o ponteiro anterior é restaurado quando possível e o documento atual permanece ativo; troca e exclusão também abortam quando o flush do store dirty falha.

Eventos de outra aba mantêm o registro e os stores coerentes sem alterar silenciosamente o documento errado. No documento ativo, update limpo recarrega bytes persistidos e update/exclusão dirty preserva estado e histórico como conflito. Uma exclusão ativa limpa aposenta o store/resumo e escolhe fallback: cache limpo é recriado dos bytes persistidos atuais, cache dirty é mantido com histórico, e ausência de fallback cria um substituto; falha nessa persistência deixa recuperação ready/dirty para `flush()` posterior seguro. Em documento inativo, update limpo atualiza o cache, exclusão limpa remove cache/resumo, e cache dirty preserva estado/histórico e sinaliza conflito sem trocar o ativo. Eventos de documento inativo sem cache atualizam ou removem apenas o resumo do registro, mantendo o documento ativo intacto.

As mutações usam os mesmos limites do formato que a ingestão: no máximo 1.000 nós, 5.000 arestas, IDs de 64 caracteres, rótulos de 500, títulos de 200 e coordenadas entre -1.000.000 e 1.000.000. Leituras públicas de estado, índice e documentos retornam snapshots/clones, portanto código externo não pode alterar o modelo fora dos comandos.

## Arquitetura

- `types.ts`: contrato do diagrama e envelope v1.
- `catalog.ts`: catálogo, versão e aliases públicos.
- `twemoji.ts`: subset pinado de símbolos Twemoji usado sem rede no catálogo e no export.
- `format.ts`: validação, normalização, migração e importação.
- `document-storage.ts`: registro e persistência multi-documento.
- `model.ts`: estado `doc`/`ui`, histórico, templates e o único caminho de escrita.
- `geometry.ts` e `rough.ts`: cálculos e traços puros.
- `theme.ts`: tokens claros/escuros e cores semânticas de categoria; export usa sempre o tema claro.
- `markup.ts`: markup puro das camadas de documento, interação, overlay e SVG exportável.
- `canvas-renderer.ts`: render completo, render de UI e patch de drag com DOM estável.
- `browser-io.ts`: fronteira injetável para lifecycle, status e downloads JSON/SVG/PNG.
- `main.ts`: somente integração DOM, eventos, viewport e composição do browser IO.

Toda mutação deve passar pelo store de `model.ts`, usando `update()` nos modos `transient`, `commit` ou `ui-only`; não persista nem altere o documento diretamente em renderização ou listeners. `ui-only` recebe em runtime somente um clone do estado de UI, portanto nem um callback mal tipado consegue alterar o documento, histórico ou persistência por esse modo. `geometry.ts` e `markup.ts` permanecem puros e não importam `model.ts`.

Exportações JSON e SVG retornam resultados explícitos para falhas de Blob, object URL, clique e limpeza. PNG rasteriza o SVG em escala 2 e é recusado antes de alocar canvas quando excede 8.192 px por lado ou 32.000.000 pixels, orientando o uso de SVG. Carregamento da imagem e callback de `toBlob()` têm timeout padrão de 10 segundos; ao expirar, handlers e timer são limpos, a URL temporária é revogada uma vez e callbacks tardios são ignorados. Falhas de imagem, canvas, contexto 2D e codificação também são apresentadas ao usuário.

## Estado da entrega e pendências

Os pacotes de design P00–P09 estão implementados. P07 usa um subset local de 65 símbolos Twemoji v17.0.3 com fonte, licença e checksums registrados; P08 entrega tema escuro persistente e apresentação progressiva com laser; P09 conclui os gates automatizáveis e o smoke Chromium/Linux descrito em `docs/evidencia-design.md`.

Não existe CI, configuração de remoto ou deploy; esses itens, CSP e cabeçalhos de hospedagem continuam deliberadamente adiados até autorização e definição do provedor. SVG autocontido com metadata JSON, URL compartilhável e PWA continuam fora do escopo. A suíte de 141 testes em 15 arquivos e o smoke real disponível não substituem a validação manual residual em Firefox, macOS, Windows, NVDA e Orca documentada sem falsos positivos.
