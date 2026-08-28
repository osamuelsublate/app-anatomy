# PESQUISA — Formas profissionais para os blocos do Anatomia

Base: relatórios das frentes notações-clássicas, ferramentas-pro e princípios-iconografia; catálogo real lido de `/home/sublate/projects/app-anatomy/src/catalog.ts` (**62 blocos em 8 categorias** — não 72/9 como constava no briefing; a tabela abaixo cobre os 62, na ordem do arquivo).

---

## 1. Panorama: de onde vêm as formas e o que faz um set parecer profissional

O vocabulário visual de diagramas técnicos vem de quatro linhagens que hoje convivem misturadas:

1. **ISO 5807 (fluxogramas, anos 60–70)** — deu ao mundo o cilindro (banco de dados, literalmente a pilha de pratos de disco magnético), o losango (decisão), a pílula (início/fim), o documento de base ondulada. A maior parte morreu (fita, collate, paralelogramo I/O), mas o cilindro é o símbolo mais bem-sucedido da história da diagramação — universal em Visio, draw.io, Mermaid (`cyl`), Material, Lucide, Carbon e Structurizr.
2. **UML/BPMN** — deram o boneco-palito (ator), o envelope-em-círculo (evento de mensagem), o relógio (timer event) e o cubo 3D de deployment (morto fora de documentação formal). O lollipop/socket de interface é a única notação formal de "API" que existe — e é ilegível para o público-alvo.
3. **Tradição de redes (Cisco/Visio)** — muro de tijolos (firewall), nuvem (rede externa, em uso desde a ARPANET ~1977), rack de servidor, roteador com antenas. Os ícones Cisco específicos (puck com setas cruzadas) são jargão de certificação; as metáforas (muro, nuvem, rack) viraram domínio público de fato.
4. **Cloud vendors e design systems (AWS/Azure/GCP, Material/Carbon/Lucide/Octicons)** — não inventaram formas novas; sistematizaram: grade fixa, stroke único, **cor por categoria no contêiner e glifo monocromático**, dois níveis (serviço/recurso), rótulo obrigatório.

O consenso destilado dos quatro sistemas de design auditados (Carbon, Material, Atlassian, Octicons) sobre o que faz um set "adulto": **monolinha geométrica com um único peso de traço; grade única com keylines que equalizam peso óptico (o círculo é desenhado maior que o quadrado de propósito); monocromia com o glifo herdando `currentColor`; 2D frontal, zero 3D/gradiente/sombra; política única de cantos e terminais; uma metáfora por conceito, usada identicamente sempre; rótulo de texto como portador primário do significado.** Detalhe importante do Octicons/Material: cada tamanho é **redesenhado**, não escalado — o orçamento de detalhe a 16px é ~2–3 traços internos; a 32–48px cabem 4–6 elementos.

Por que o emoji atual quebra tudo isso: renderização fora de controle (Apple ≠ Noto ≠ Windows), 5–10 cores saturadas + brilho 3D por glifo (imune a tema claro/escuro e a tokens), nenhuma grade comum, e registro emocional casual. O que era "infantil" no app **não é o traço rough — é o emoji**.

Segunda lição estrutural, do C4 e das ferramentas modernas (Eraser, IcePanel): **nó ≠ ícone**. O contêiner uniforme (caixa arredondada, cor de categoria) + rótulo carregam a identidade; o glifo é identificador secundário. Silhueta própria de nó se reserva a um punhado de arquétipos universais (cilindro, nuvem, pessoa); passou de ~4–6 formas especiais, ninguém decodifica. E o C4 é explícito: nenhuma notação é autoevidente — legenda/rótulo sempre.

---

## 2. Direção de estilo recomendada

**Grade e traço.** Set autoral em **24×24px, stroke 2px centrado, round caps + round joins, corner radius 2px externo, cantos internos retos, espaço negativo mínimo de 2px** — a gramática Lucide, que já é o set do chrome do app (coerência garantida entre toolbar e canvas). Keylines à la Material (quadrado 18, círculo 20, retângulos 20×16/16×20) para equalizar volume óptico. Renderizado no nó a **32–48px (~40–55% da altura do nó)** com stroke reescalonado proporcionalmente (2px@24 ≈ 3px@40), senão o glifo fica anêmico ao lado do contorno rough.

**Cor.** Glifo 100% monocromático em `currentColor`. A informação de categoria vai para o **contêiner** (borda ou chip tingido com acento dessaturado por categoria — 8 acentos derivados dos tokens de `theme.ts`, mantendo #6965DB como acento de UI). É o modelo AWS/IcePanel: cor sinaliza família sem poluir o símbolo. Permitir no máximo **1 área preenchida pequena por glifo** como assinatura (o LED do rack, o furo do cadeado, o raio do cache) — o eixo *fill* do Material como inspiração.

**Anatomia do nó.** Manter o markup atual (retângulo arredondado + glifo + rótulo) como forma-padrão para quase tudo. Conceder silhueta própria de nó apenas aos arquétipos que o leigo ou o mercado inteiro reconhecem: **cilindro** para a categoria Dados (opcional), **nuvem** para nuvem/internet, **pessoa** para a categoria Pessoas. Rótulo sempre presente, fora da área do glifo, em fonte de UI — nunca depender do glifo sozinho.

**Decisão sobre o rough: FICA — no contorno do nó; o glifo fica quase crisp.** Fundamentos:

- O hand-drawn é compatível com seriedade e é *vantagem pedagógica*: Excalidraw é adotado por engenharia exatamente por sinalizar "documento de trabalho, não spec final", e a literatura de HCI (Wong, CHI '92) mostra que sketches dirigem a atenção para estrutura, não aparência. Para leigos, o rough reduz intimidação — diz "isto é um modelo mental". Abandoná-lo jogaria fora a identidade do app para virar um Eraser pior.
- O que separa rough profissional de infantil é a **disciplina sob o jitter**: geometria em grade antes do ruído, seed determinístico (o app já tem), paleta contida, tipografia de UI reta.
- Regra operacional nova: **jitter proporcional à dimensão do path, com piso ~0 abaixo de ~24px**. Contorno do nó (100–160px) bem rough; glifo de 32–48px com ruído ≤0.5px ou nenhum. Ruído que é charme numa caixa de 140px destrói um glifo pequeno (coerente com o orçamento de detalhe por tamanho da seção 1). Existe ecossistema de libraries "sketchy" de ícones AWS para Excalidraw provando que glifo técnico + rough coexistem — mas a versão segura e mais barata é rough forte no contêiner, glifo disciplinado. Se o glifo destoar por parecer "limpo demais", aplicar um jitter mínimo com a mesma seed, para a "mesma mão" desenhar caixa e glifo.

---

## 3. Tabela completa (62 blocos, ordem do catalog.ts)

Legenda: **Rec.** = reconhecibilidade para leigo sem legenda (A/M/B). Todos os glifos abaixo são desenháveis com `rect/circle/ellipse/line/polyline/path` — nenhum exige ilustração.

### Pessoas

| Bloco | Forma recomendada | Geometria SVG-ready | Origem | Rec. |
|---|---|---|---|---|
| Usuário | Pessoa (head-and-shoulders) | Círculo (cabeça) sobre arco/meio-estádio (ombros) cortado na base | UML ator → modernizado C4/Structurizr; Material `person` | **A** — símbolo mais seguro do catálogo |
| Dev | Pessoa + code | Busto pequeno + chevrons `< >` com barra diagonal ao lado (ou monitor com `</>`) | Consenso de mercado (Carbon `code`, Lucide) | M — rótulo resolve |
| Operações | Pessoa + engrenagem | Busto + engrenagem pequena (círculo + 6 dentes + furo) no quadrante inferior direito | Carbon `user--settings` | M |
| Suporte | Cabeça com headset | Círculo + arco por cima (haste) + cápsula na base (microfone) | Material `support_agent`, Lucide `headset` | **A** |
| Atacante | Pessoa com X (ou capuz) | Busto + X pequeno de 2 traços no canto; alternativa: silhueta de capuz (arco pontudo sobre busto) | Lucide `user-x`; sets sérios evitam máscara/ladrão | M — capuz lê melhor para leigo; manter rótulo |

### Dispositivos & Frontend

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Computador | Laptop | Retângulo arredondado (tela) sobre trapézio achatado (base) | Universal (Lucide `laptop`) | **A** |
| Celular | Smartphone | Retângulo vertical arredondado + traço curto na base | Universal, convenção de mockup | **A** |
| Navegador | Janela com barra | Retângulo arredondado + linha horizontal (barra) + 2–3 pontinhos à esquerda | Convenção de wireframe/traffic-lights; Lucide `app-window` | **A** — melhor símbolo leigo para "roda no seu computador"; abandonar a bússola 🧭 |
| Frontend | Janela + wireframe | Janela de navegador com retângulo largo no topo + duas colunas de retângulos dentro (mosaico `dashboard`) | Material `space_dashboard` | M — rótulo forte |
| Cookies / storage | Cookie | Círculo + 4–5 pontinhos irregulares | Lucide `cookie`; metáfora literal universalizada pelos banners de consentimento | **A** |

### Rede & Caminho

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Roteador / Wi-Fi | Caixa com antena + sinal | Retângulo baixo arredondado + 1–2 antenas verticais + ponto com 2 arcos concêntricos | Visio/rede clássico (evitar círculo-com-setas Cisco) | **A** — o objeto existe na casa do leigo |
| Provedor (ISP) | Torre de transmissão | Mastro triangular + arcos de onda dos dois lados do topo | Consenso de mercado | M |
| Internet | Globo | Círculo + elipse vertical (meridiano) + 2 cordas horizontais (paralelos) | Universal (Material `language`, Lucide `globe`) | **A** |
| Domínio | Etiqueta/tag | Retângulo com ponta chanfrada + furo circular | Consenso GUI (Lucide `tag`) | M — rótulo carrega |
| DNS | Lista nome→endereço | Retângulo (página) com 2–3 linhas, cada linha com ponto + seta curta → traço | Sem canônico (o Material `dns` é um rack — não copiar!); glifo autoral sobre a metáfora "lista telefônica" já usada na desc do bloco | B — rótulo obrigatório |
| CDN | Nós distribuídos sobre globo | Círculo grande (globo simplificado) + 3 círculos pequenos na borda conectados por linhas radiais a um ponto central | Convenção CloudFront/Azure CDN | B — rótulo obrigatório |
| Load balancer | Fan-out | Círculo (ou quadrado arredondado) central + 1 seta entrando à esquerda + 3 setas saindo em leque à direita | AWS ELB/Azure LB; o desenho da função venceu o ícone Cisco | M — leigo entende o leque com legenda |
| Proxy | Nó intermediário | Seta A → quadradinho central → seta B (três elementos em linha) | Convenção fraca; desenho da função. **Abandonar a máscara 🎭** (piada, não convenção) | B — rótulo obrigatório |
| VPN | Túnel com cadeado | Arco de meia-elipse (boca de túnel) + seta atravessando + cadeado mini sobreposto | Azure VPN (caminho + cadeado); metáfora "túnel" já está na desc | M |

### Backend

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Servidor web | Rack + globo | Retângulo vertical com 2 faixas (ponto-LED à esquerda, traços à direita) + globo pequeno no canto | Composição padrão de mercado | B–M — rótulo forte |
| API | Setas request/response | Retângulo arredondado com par de setas opostas ⇄ dentro | Sem canônico único (Material `api` é losango+colchetes); ⇄ comunica "pede e recebe" melhor para leigo que `{ }` ou lollipop UML | M |
| Monolito | Bloco maciço único | Retângulo grande de cantos retos com preenchimento sólido (a exceção filled do set) — opcionalmente com 2–3 linhas internas sugerindo camadas soldadas | Convenção diagramática C4/UML (um retângulo só); Material `deployed_code` filled | B — rótulo obrigatório; o contraste com o hexágono do microsserviço ensina o conceito |
| Microsserviço | Hexágono | Hexágono regular de cantos levemente arredondados (vazio ou com ponto central) | Arquitetura hexagonal + Kubernetes icon set + diagramas AWS — convenção consolidada | B — rótulo obrigatório; par visual com o monolito |
| Autenticação | Chave | Círculo (cabeça) + haste horizontal + 2 dentes | Universal (Material/Lucide `key`, AWS IAM) | **A** |
| Autorização | Escudo com check | Pentágono arredondado de base em ponta + check de 2 traços dentro | Material `verified_user`; distinção canônica auth=chave / authz=escudo+check | **A** (escudo) — a distinção precisa do rótulo |
| Regras de negócio | Mini-fluxograma | Losango pequeno (decisão) conectado por 2 traços a 2 caixinhas | Carbon `decision-tree`; herda o losango ISO | M — abandona a engrenagem duplicada com Worker |
| Worker | Engrenagem | Círculo com 6–8 dentes trapezoidais + furo central; opcional seta circular parcial em volta | Universal (processamento) | **A** (engrenagem = "trabalhando") |
| Fila de mensagens | Caixinhas em fila + seta | 3 retângulos verticais enfileirados na horizontal + seta de direção | AWS SQS/Azure Queue; preferir à alternativa cilindro-deitado (conflito ISO "storage" e ilegível p/ leigo) | M — autoexplicativa com legenda |
| Agendador (cron) | Relógio | Círculo + 2 ponteiros em L + 4 ticks opcionais | BPMN timer event; Material `schedule` | **A** |
| Tempo real | Raio | Zigue-zague de 3 segmentos (polígono), pequeno fill como assinatura | Cultura dev "conexão viva/rápido"; Lucide `zap` | **A** como "energia/instantâneo" — ver conflito com Cache na seção 4 |

### Dados

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Banco de dados | **Cilindro** | Elipse no topo + 2 laterais retas + arco na base + 1–2 arcos internos (discos) | ISO 5807 → universal absoluto em todas as ferramentas | B para leigo sem legenda, mas é A dentro do curso: é O símbolo a ensinar; candidata a silhueta de nó da categoria |
| Banco NoSQL | Cilindro + chaves | Cilindro + `{ }` sobrepostas na face frontal | Variante de mercado (documento JSON) | B — rótulo obrigatório |
| Cache | Cilindro pequeno + raio | Cilindro reduzido com raio de 3 segmentos sobreposto (o fill de assinatura) | Escola dominante "dado rápido" (vs chip de RAM) | M — raio = "rápido" é intuição direta |
| Arquivos (S3) | Pasta (ou balde) | Retângulo com aba superior esquerda; alternativa fiel: trapézio invertido + elipse no topo (bucket) | Pasta = GUI universal; balde = literalismo S3 | **A** (pasta) — preferir pasta para leigo |
| Backup | Cilindro + seta circular | Cilindro pequeno + seta em arco anti-horário envolvendo (voltar no tempo) | Material `settings_backup_restore` (ideia-chave dos sets) | M |
| Data warehouse | Prédio + cilindros | Retângulo largo com telhado (traço em ^) + 2–3 cilindros mini dentro | Sem canônico (BigQuery usa lupa+painel); glifo autoral sobre "depósito" | B — rótulo obrigatório |

### Integrações

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Email (SMTP) | Envelope | Retângulo + 2 diagonais dos cantos superiores ao centro (aba em V) | BPMN message event; universal absoluto | **A** |
| Pagamentos | Cartão | Retângulo arredondado horizontal + faixa grossa no terço superior + 1 traço curto abaixo | Universal | **A** |
| Login social | Crachá/ID | Retângulo vertical arredondado + círculo (foto) + 2 linhas (dados) + check pequeno | Consenso GUI (`id-card`) — o 🪪 atual já acertou a metáfora | M |
| WhatsApp / SMS | Balão de fala | Retângulo arredondado + rabinho triangular na base esquerda | Universal | **A** |
| Push | Sino | Curva de sino truncada + traço de base + círculo (badalo) | Material `notifications`; universal | **A** |
| API de terceiros | Peça de puzzle | Quadrado com 2 nós semicirculares salientes (topo e lateral) | Material `extension`; alternativa: plugue | **A** ("encaixa algo de fora") |
| IA / LLM | Faísca de 4 pontas | Losango côncavo ✦ (4 pontas, curvas para dentro), opcional faísca menor ao lado | Convenção 2023+ (Material `auto_awesome`, Gemini, Azure OpenAI). **Nunca robô** — nenhum set profissional usa | **A** — leigos já associam a faísca a IA pelos próprios produtos |
| Mapas | Pin | Gota invertida (círculo + ponta em V) com furo circular | Universal (Google Maps) | **A** |
| Webhook | Anzol simples | Curva em J com farpa + círculo pequeno na ponta superior (o "evento" fisgado) | O glifo canônico Material/Lucide `webhook` (3 círculos + arcos) é dev-only; anzol serve a metáfora do nome e à desc "outro sistema avisa o seu" | B — rótulo obrigatório de qualquer forma |

### Segurança

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| HTTPS / Certificado | Cadeado fechado | Retângulo arredondado (corpo) + arco (shackle) + furo (círculo+traço, fill de assinatura) | GUI universal — é o ícone do navegador | **A** |
| Firewall | Muro de tijolos | Retângulo + 3 fiadas horizontais com juntas verticais alternadas (6–8 traços) | Cisco/Visio/Azure/Carbon; metáfora "barreira" autoexplicativa | **A** |
| WAF | Escudo + grade | Escudo (pentágono arredondado, base em ponta) com padrão de tijolos/grade interna | Azure WAF (muro+escudo), AWS WAF | B — rótulo obrigatório; o par escudo+tijolos diferencia do firewall |
| Cofre de segredos | Cofre | Quadrado arredondado + círculo concêntrico duplo central (dial) + 2 traços de dobradiça | Consenso de mercado (Azure Key Vault = chave em caixa) | **A** ("cofre") |
| Proteção DDoS | Escudo + setas convergindo | Escudo + 3 setas curtas apontando contra ele de fora | AWS Shield + desenho da função | M — abandona a onda 🌊 (ambígua) |

### Infra & Operação

| Bloco | Forma | Geometria | Origem | Rec. |
|---|---|---|---|---|
| Servidor | Rack | Retângulo vertical dividido em 2–3 faixas; cada faixa com ponto (LED, fill de assinatura) à esquerda + 2 traços à direita | Universal (Carbon `bare-metal-server`; venceu o cubo UML e a torre 3D Cisco) | M — leigo lê "máquina" com rótulo |
| Container | Cubo isométrico em linha | Hexágono + linhas em Y invertido (3 faces); alternativa leiga: caixa de papelão com fita (retângulo + abas) | Material `deployed_code`, convenção Docker/K8s | M — caixa lê melhor para leigo; cubo é mais "pro". Decisão: **caixa com fita** (a desc do bloco já diz "embalada") |
| Kubernetes | Leme genérico | Círculo + círculo interno + 6–7 raios + 6 cabos curtos externos | Leme CNCF é **marca registrada** — desenhar leme genérico, nunca o logo | B — rótulo obrigatório |
| Nuvem | Nuvem | Path de 3–4 arcos de raios diferentes fechado por base reta | ARPANET ~1977 → universal | **A** — o único símbolo de infra 100% leigo |
| Datacenter | Prédio com janelas | Retângulo vertical + grade 2×3 de janelinhas quadradas | Consenso de mercado | **A** ("prédio") |
| Ambientes | Frasco de laboratório | Erlenmeyer: triângulo de base larga + gargalo + traço de líquido; **+ badge de texto DEV/PROD como reforço** | Convenção fraca (GUI "beta/teste") | B — caso difícil, ver seção 4 |
| Deploy / CI-CD | Foguete | Corpo ogival + 2 aletas + círculo (janela) + chama de 2 traços | Cultura dev/GitHub ("ship it"); a alternativa rigorosa (pipeline de círculos+check) é dev-only | **A** — para público leigo o foguete vence o pipeline |
| Git / versões | Grafo de branch | Linha vertical com círculo em cada ponta + arco ramificando para 3º círculo deslocado | Lucide/Octicons/Carbon `git-branch` idênticos | B — rótulo obrigatório (mas é o único glifo possível) |
| Monitoramento | Pulso ECG | Polilinha com pico agudo, dentro de círculo opcional | Material `monitor_heart`, Lucide `activity`; dominante em status pages | **A** — "sinais vitais" casa com a desc do bloco |
| Logs | Página com linhas | Retângulo com canto dobrado (dog-ear: triângulo) + 3–4 linhas de comprimentos variados | ISO documento modernizado pelo dog-ear de GUI (venceu a base ondulada para leigos) | **A** ("papel escrito") |
| Analytics | Barras + tendência | 3 barras verticais de alturas variadas sobre linha de base + seta ascendente opcional | Universal | **A** |
| Alertas | Triângulo com exclamação | Triângulo equilátero de cantos arredondados + traço + ponto (fill de assinatura) | Universal (sinalização viária → GUI); preferível ao sino (colide com Push) | **A** |

**Contagem de reconhecibilidade:** 30 A, 18 M, 14 B. Todos os B mantêm rótulo forte — o que o app já garante por design (rótulo faz parte do markup do nó). Nenhuma divergência grave entre pesquisadores na tabela; as decisões onde havia escolha estão justificadas na própria linha (fila caixinhas > cilindro deitado; pasta > balde; caixa > cubo; foguete > pipeline; anzol > webhook canônico; triângulo > sino para alertas).

---

## 4. Casos difíceis — decisão e raciocínio

**IA/LLM.** Único conceito onde a convenção nasceu depois de 2020 e já venceu: a **faísca de 4 pontas** (✦), padronizada por Material `auto_awesome` e adotada por Gemini, Azure OpenAI e praticamente todo produto com IA. O leigo a reconhece dos apps do próprio celular. Robô está vetado — nenhum set profissional usa, e infantiliza exatamente o bloco mais "quente" do curso.

**Webhook.** Existe glifo canônico (Material/Lucide: 3 círculos conectados por arcos), mas ele é abstrato até para devs. Como o nome em português do bloco carrega a metáfora ("gancho") e a desc explica a função, o **anzol em J** serve melhor ao público — é um caso onde fidelidade ao set canônico perderia para a didática. Reconhecibilidade continua B; o rótulo trabalha.

**Login social.** Sem convenção neutra (os ícones reais são logos de Google/Facebook — marcas, fora de questão). O **crachá com foto + check** comunica "identidade emprestada verificada" e já era a intuição do emoji atual (🪪). Alternativa descartada: busto+chave, que colide com Autenticação.

**Ambientes (teste vs produção).** Vácuo notacional real — nenhum set tem símbolo, e a prática da indústria é **texto** (badge DEV/STAGING/PROD). Decisão: frasco Erlenmeyer como glifo (metáfora "laboratório", já sugerida pelo 🧪 atual) **mais** suporte no app a badge textual no nó — é o único bloco onde a solução profissional é tipográfica, não iconográfica.

**Analytics vs Monitoramento vs Logs.** Trio que se confunde. Resolver por metáforas disjuntas: barras (o que usuários fazem), pulso ECG (saúde do sistema), página escrita (registro). Nunca usar gauge/velocímetro ou lupa, que flutuam entre os três.

**Conflito do raio (decisão exigida).** O raio tem 3 significados históricos (link serial ISO/Cisco, erro BPMN, "rápido" na cultura dev) e o catálogo o pede em dois blocos: Cache e Tempo real. Regra adotada: para o leigo o raio lê "instantâneo/energia" — então **Tempo real fica com o raio puro** (conexão viva) e **Cache usa o raio apenas como badge pequeno sobre o cilindro** (a forma-mãe é o cilindro = dado; o raio é modificador). Nunca usar raio para link de comunicação no app.

**Hexágono.** Também polissêmico (preparation ISO, display, microsserviço). Vencedor moderno inequívoco: **hexágono = microsserviço** (arquitetura hexagonal, Kubernetes). Reservá-lo exclusivamente para esse bloco.

**DNS, proxy, warehouse, monolito** — os quatro glifos verdadeiramente autorais do set (nenhuma convenção utilizável). A estratégia comum: desenhar **a função, não o aparelho** (lista nome→número; A→▢→B; depósito de cilindros; bloco maciço), seguindo o precedente do load balancer, cujo fan-out — desenho da função — derrotou o ícone Cisco do aparelho.

---

## 5. Plano de execução sugerido (sem implementar)

**Volume:** 62 glifos de bloco + 8 ícones de categoria (reutilizar o glifo do bloco mais representativo de cada uma: pessoa, laptop, globo, engrenagem, cilindro, puzzle, cadeado, rack) ≈ **~64 desenhos únicos** (categoria reaproveita). Formato: paths SVG inline em um módulo TS (`src/icons.ts`), `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, viewBox 24×24 — zero dependências, compatível com o render innerHTML.

**Ordem:**
1. **Onda 1 — os 10 `ESSENTIAL_BLOCK_IDS`** (`usuario, navegador, frontend, api, auth, sql, cache, email, https, servidor`): valida a gramática inteira (grade, stroke reescalonado, jitter-piso, fill de assinatura, cor de categoria) com os blocos mais usados. Inclui de brinde 3 formas-mãe (pessoa, cilindro, cadeado) reutilizadas em 9 outros glifos.
2. **Onda 2 — formas-mãe restantes e derivados**: nuvem, escudo, rack, globo, sino, engrenagem, relógio, envelope → destrava seguranca, infra e integracoes quase inteiras por composição.
3. **Onda 3 — glifos compostos** (servidor web, backup, cache, waf, ddos, vpn, cdn).
4. **Onda 4 — autorais** (dns, proxy, warehouse, monolito, ambientes, webhook) — por último, quando a "mão" do set já estiver estabelecida.
5. Remover `twemoji.ts`/`iconIdForEmoji` do pipeline do catálogo ao final.

**Critérios de pronto (por glifo):**
- Legível a 50% de zoom do canvas (~16–20px efetivos): silhueta distinguível de qualquer outro glifo do set em teste de miniatura lado a lado.
- Coordenadas inteiras ou .5 na grade 24; nenhum detalhe < 2px; stroke único; 0 ou 1 área filled.
- Passa no "teste da mesma mão": renderizado dentro do nó rough claro E escuro sem parecer colado de outro app (jitter-piso aplicado, peso óptico equalizado por keyline).
- Nenhuma metáfora duplicada no set (matriz conceito×metáfora revisada — ex.: sino só em Push, raio nunca como link).

**Licenças:** derivar livremente de **Lucide (ISC)**, **Material Symbols (Apache 2.0, remix explícito)** e **Carbon (Apache 2.0)** — os três permitem modificação, o que cobre a re-renderização rough; manter atribuição num NOTICE. **Proibido**: paths de AWS Icons (CC-BY-**ND** — redesenhar no traço rough é obra derivada vedada), Azure/GCP (uso restrito a diagramas, não a produtos), logo Kubernetes (marca CNCF — usar leme genérico). AWS/Azure/GCP servem só como referência de convenção (fan-out, cor por categoria, dois níveis).

---

## 6. Referências

Abertas pelos pesquisadores: https://www.useworkspace.dk/en/blog/iso-5807-flowchart-symbols-guide · https://mermaid.js.org/syntax/flowchart.html · https://c4model.com/diagrams/notation · https://c4model.com/abstractions/queues-and-topics · https://v10.carbondesignsystem.com/guidelines/icons/contribute/ · https://v10.carbondesignsystem.com/guidelines/pictograms/usage/ · https://m1.material.io/style/icons.html · https://atlassian.design/foundations/iconography · https://primer.style/octicons/design-guidelines/ · https://docs.eraser.io/docs/icons · https://github.com/google/material-design-icons · https://lucide.dev/license · https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/LICENSE · https://github.com/jgraph/drawio/discussions/5327 · https://learn.microsoft.com/en-us/azure/architecture/icons/ · https://diagrams.so/blog/aws-architecture-diagram-best-practices · https://www.eraser.io/use-case/architecture-diagrams · https://www.hackdesign.org/toolkit/excalidraw · https://cieden.com/book/sub-atomic/iconography/icon-grids-and-keylines · https://www.fromzerotoccna.com/visualizing-cisco-networks/

Via snippet/busca (não abertas integralmente): docs.structurizr.com · uml-diagrams.org · processcamp.io e camunda.com (BPMN) · aws.amazon.com/architecture/icons · gliffy.com/blog/aws-architecture-icons · lucide.dev/contribute/icon-design-guide · icepanel.io (C4) · gleek.io / red-gate.com / creately.com (ERD) · dl.acm.org/223904.223910 (Wong, sketching) · medium.com/@garbermm (emoji em UI). De memória (sinalizado nos relatórios): geometrias detalhadas dos glifos canônicos dos sets, cores de categoria AWS, C4 model, convenção da faísca de IA, bibliotecas sketchy para Excalidraw.

Arquivo-fonte do catálogo: `/home/sublate/projects/app-anatomy/src/catalog.ts` (62 blocos, 8 categorias, constante `ESSENTIAL_BLOCK_IDS` usada no plano).