<!-- generated-by: gsd-doc-writer -->
# Entrega diferida: CI e hospedagem estática

Este documento registra a entrega futura sem escolher provedor nem implementar CI, remoto, hospedagem ou deploy.

## Artefatos versionados

**Decisão:** manter `public/js/` rastreado pelo Git.

`npm run build` compila `src/` diretamente para `public/js/`, e o artefato publicável é o conteúdo completo de `public/`. Manter o JavaScript gerado no repositório permite publicar sem instalar Node no host e torna cada revisão/rollback autocontido. Alterações em `src/` e no `public/js/` correspondente devem entrar juntas; não editar `public/js/` manualmente.

## Gates futuros de CI

Não há CI configurada no repositório. Quando a entrega for autorizada, executar nesta ordem, em checkout limpo e com Node.js >= 18 compatível com o lockfile:

```sh
npm ci
npm test
npm run check
npm run build
npm run check:freshness
```

`npm test` remove `.test-dist/` antes de compilar e executa atualmente 141 casos em 15 arquivos com `node:test`. `npm run build` remove `public/js/` antes de emitir os 13 módulos, evitando artefatos órfãos. O último gate faz uma compilação temporária limpa, compara nomes e bytes com `public/js/` e remove `.freshness-dist`; ele falha para módulos ausentes, extras ou divergentes e passa na revisão atual. Esses scripts são gates locais e não constituem CI: nenhum pipeline ou proteção de branch exige sua execução. Um pipeline futuro deve parar no primeiro erro e só publicar a revisão que passou por todos eles.

## Contrato da hospedagem estática

- Publicar o **conteúdo** de `public/` na raiz do site; não expor a raiz do repositório, `src/`, testes ou `node_modules/`.
- Servir por HTTPS e preservar caminhos relativos (`/styles.css`, `/js/*.js`, `/templates/*.json`).
- Enviar MIME types corretos, em especial JavaScript de módulo (`text/javascript` ou `application/javascript`), CSS, JSON e SVG.
- Não é necessário fallback de SPA: não há roteamento por pathname. Respostas inexistentes devem continuar como `404`.
- Preferir publicação atômica e retenção de pelo menos uma versão anterior para rollback.
- O host deve permitir cabeçalhos HTTP de segurança e controle de cache.

### CSP recomendada

Aplicar primeiro em `Content-Security-Policy-Report-Only`, validar o smoke test e então promover para:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'; manifest-src 'self'; upgrade-insecure-requests
```

A política permite o favicon `data:`, os downloads/imagens locais via `blob:` e o carregamento dos templates no mesmo domínio, mas bloqueia workers. `frame-ancestors` deve ser enviado como cabeçalho HTTP, não apenas como `<meta>`.

## Cache e rollback, sem service worker

- Não registrar service worker nem publicar arquivo de service worker nesta entrega.
- Servir `index.html` com `Cache-Control: no-cache` (ou `max-age=0, must-revalidate`).
- Como CSS, JS e templates têm nomes estáveis, usar revalidação (`no-cache`) ou TTL curto; **não** usar `immutable` enquanto não houver nomes com hash de conteúdo.
- Em rollback, republicar atomicamente o artefato `public/` da revisão anterior que passou pelos gates e invalidar/purgar o cache do provedor para `index.html`, `styles.css`, `js/*` e `templates/*`.
- Validar o rollback em uma nova sessão do navegador. Sem service worker, não existe cache persistente adicional a remover no cliente.

## Pré-requisitos de Git e branch

Antes de automatizar:

1. Criar o primeiro commit incluindo fontes, lockfile e `public/js/` fresco.
2. Definir a branch padrão e a branch/revisão autorizada a publicar.
3. Configurar um remoto, autenticação com privilégio mínimo e proteção da branch padrão.
4. Exigir os gates acima para merge/publicação e impedir deploy de worktrees sujas.
5. Escolher o provedor estático, o domínio e, se necessário, credenciais protegidas no ambiente de CI.
6. Definir quem pode promover e reverter uma versão.

No estado atual deste documento, o repositório ainda não possui commit nem remoto; esses itens continuam deliberadamente pendentes.

## Checklist manual de release

- [ ] Confirmar a revisão e que o checkout está limpo.
- [ ] Executar os cinco gates locais acima.
- [ ] Executar `npm run serve` e abrir `http://localhost:8137/`.
- [ ] Fazer smoke de criar, conectar, mover, editar, desfazer, salvar, abrir e exportar.
- [ ] Exercitar criação/importação/modelo com primeira persistência falha, troca/exclusão com flush falho e conflito dirty entre abas.
- [ ] Na exclusão externa limpa, confirmar fallback limpo recarregado dos bytes persistidos atuais, fallback dirty com estado/histórico preservados e substituto ready/dirty recuperável quando sua persistência falhar.
- [ ] Para documentos inativos, confirmar update/exclusão de cache limpo, preservação/conflito de cache dirty e atualização/remoção do registro quando não houver cache, sempre sem trocar o ativo.
- [ ] Observar que uma exclusão inativa pode exibir status de “diagrama removido” apesar de o documento ativo e seu estado permanecerem corretos.
- [ ] Exercitar downloads JSON/SVG/PNG, inclusive recusa de raster excessivo e timeout de imagem/`toBlob()` com limpeza do recurso temporário.
- [ ] Confirmar carregamento dos quatro arquivos em `public/templates/` e ausência de erros no console.
- [ ] Publicar somente `public/` como uma unidade atômica.
- [ ] Confirmar HTTPS, MIME types, CSP e políticas de cache em produção.
- [ ] Repetir o smoke essencial em produção em uma nova sessão.
- [ ] Registrar revisão, horário, responsável e identificador do artefato publicado.
- [ ] Manter identificada a última revisão aprovada e testar o procedimento de rollback.
