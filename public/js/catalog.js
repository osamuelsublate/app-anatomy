import { iconIdForEmoji } from "./twemoji.js";
export const CATALOG_VERSION = "3";
/**
 * Deprecated public block IDs mapped to their current IDs.
 * Keep entries here when a catalog ID is renamed.
 */
export const ALIASES = Object.freeze({
    database: "sql",
    "load-balancer": "loadbalancer",
    microservice: "microsservico",
});
export const ESSENTIAL_BLOCK_IDS = Object.freeze([
    "usuario",
    "navegador",
    "frontend",
    "api",
    "auth",
    "sql",
    "cache",
    "email",
    "https",
    "servidor",
]);
function b(id, icone, nome, desc) {
    return { id, icone, iconId: iconIdForEmoji(icone), nome, desc };
}
export const CATEGORIAS = [
    {
        id: "pessoas",
        nome: "Pessoas",
        icone: "🙂",
        iconId: iconIdForEmoji("🙂"),
        themeKey: "pessoas",
        blocos: [
            b("usuario", "🧑", "Usuário", "A pessoa que usa a aplicação"),
            b("dev", "👩‍💻", "Dev", "Quem escreve o código"),
            b("ops", "🧑‍🔧", "Operações", "Quem mantém tudo no ar"),
            b("suporte", "🎧", "Suporte", "Quem atende os usuários"),
            b("atacante", "🕵️", "Atacante", "Quem tenta invadir ou abusar"),
        ],
    },
    {
        id: "dispositivos",
        nome: "Dispositivos & Frontend",
        icone: "💻",
        iconId: iconIdForEmoji("💻"),
        themeKey: "dispositivos",
        blocos: [
            b("computador", "💻", "Computador", "O aparelho do usuário"),
            b("celular", "📱", "Celular", "Acesso pelo navegador do celular"),
            b("navegador", "🧭", "Navegador", "Chrome, Firefox, Safari…"),
            b("frontend", "🎨", "Frontend", "As telas: o que se vê e clica"),
            b("cookies", "🍪", "Cookies / storage", "Lembrancinhas guardadas no navegador"),
        ],
    },
    {
        id: "rede",
        nome: "Rede & Caminho",
        icone: "🌐",
        iconId: iconIdForEmoji("🌐"),
        themeKey: "rede",
        blocos: [
            b("roteador", "📶", "Roteador / Wi-Fi", "A porta de saída da sua casa"),
            b("isp", "📡", "Provedor (ISP)", "Quem te liga à internet"),
            b("internet", "🌐", "Internet", "A rede mundial de cabos e antenas"),
            b("dominio", "🏷️", "Domínio", "O nome amigável do site"),
            b("dns", "📒", "DNS", "A lista telefônica: nome → endereço"),
            b("cdn", "🛰️", "CDN", "Cópias espalhadas pelo mundo"),
            b("loadbalancer", "⚖️", "Load balancer", "Distribui a fila entre servidores"),
            b("proxy", "🎭", "Proxy", "Intermediário no caminho"),
            b("vpn", "🚇", "VPN", "Túnel privado na rede pública"),
        ],
    },
    {
        id: "backend",
        nome: "Backend",
        icone: "⚙️",
        iconId: iconIdForEmoji("⚙️"),
        themeKey: "backend",
        blocos: [
            b("servidorweb", "🚪", "Servidor web", "O porteiro (nginx) que recebe conexões"),
            b("api", "🤵", "API", "O garçom: recebe pedidos, traz respostas"),
            b("monolito", "🗿", "Monolito", "Aplicação inteira num programa só"),
            b("microsservico", "🧩", "Microsserviço", "Pedacinho independente do backend"),
            b("auth", "🔑", "Autenticação", "Descobrir quem é você (login)"),
            b("permissoes", "🛂", "Autorização", "O que cada um pode fazer"),
            b("regras", "⚙️", "Regras de negócio", "As decisões da aplicação"),
            b("worker", "🐝", "Worker", "Trabalho pesado em segundo plano"),
            b("fila", "📮", "Fila de mensagens", "Tarefas esperando a vez"),
            b("cron", "⏰", "Agendador (cron)", "Tarefas de hora marcada"),
            b("websocket", "🔌", "Tempo real", "Conexão aberta: chat, notificação viva"),
        ],
    },
    {
        id: "dados",
        nome: "Dados",
        icone: "🗄️",
        iconId: iconIdForEmoji("🗄️"),
        themeKey: "dados",
        blocos: [
            b("sql", "🗄️", "Banco de dados", "O arquivo-mestre organizado (SQL)"),
            b("nosql", "📇", "Banco NoSQL", "Dados flexíveis, sem tabelas rígidas"),
            b("cache", "⚡", "Cache", "Memória rápida pra respostas repetidas"),
            b("arquivos", "🗂️", "Arquivos (S3)", "Fotos, vídeos e PDFs"),
            b("backup", "💾", "Backup", "Cópia de segurança de tudo"),
            b("warehouse", "🏭", "Data warehouse", "Depósito de dados para análise"),
        ],
    },
    {
        id: "integracoes",
        nome: "Integrações",
        icone: "🔗",
        iconId: iconIdForEmoji("🔗"),
        themeKey: "integracoes",
        blocos: [
            b("email", "✉️", "Email (SMTP)", "Recuperar senha, boas-vindas, avisos"),
            b("pagamentos", "💳", "Pagamentos", "Stripe, Mercado Pago, Pix"),
            b("loginsocial", "🪪", "Login social", "Entrar com Google / Facebook"),
            b("whatsapp", "💬", "WhatsApp / SMS", "Mensagens direto no celular"),
            b("push", "🔔", "Push", "Notificações do navegador"),
            b("apiterceiros", "🔗", "API de terceiros", "CEP, clima, nota fiscal…"),
            b("ia", "🤖", "IA / LLM", "Claude, GPT e afins dentro do app"),
            b("mapas", "🗺️", "Mapas", "Geolocalização e rotas"),
            b("webhook", "🪝", "Webhook", "Outro sistema avisa o seu"),
        ],
    },
    {
        id: "seguranca",
        nome: "Segurança",
        icone: "🔒",
        iconId: iconIdForEmoji("🔒"),
        themeKey: "seguranca",
        blocos: [
            b("https", "🔒", "HTTPS / Certificado", "O cadeado: conversa lacrada"),
            b("firewall", "🧱", "Firewall", "O muro que barra tráfego indesejado"),
            b("waf", "🛡️", "WAF", "Escudo contra ataques web"),
            b("segredos", "🗝️", "Cofre de segredos", "Senhas e chaves da aplicação"),
            b("ddos", "🌊", "Proteção DDoS", "Segura enxurradas de acessos falsos"),
        ],
    },
    {
        id: "infra",
        nome: "Infra & Operação",
        icone: "🏗️",
        iconId: iconIdForEmoji("🏗️"),
        themeKey: "infra",
        blocos: [
            b("servidor", "🖥️", "Servidor", "O computador que nunca desliga"),
            b("container", "📦", "Container", "A aplicação embalada (Docker)"),
            b("k8s", "☸️", "Kubernetes", "O maestro dos containers"),
            b("nuvem", "☁️", "Nuvem", "Computadores alugados (AWS, GCP…)"),
            b("datacenter", "🏢", "Datacenter", "O prédio cheio de servidores"),
            b("ambientes", "🧪", "Ambientes", "Teste vs produção"),
            b("deploy", "🚀", "Deploy / CI-CD", "O código novo indo ao ar"),
            b("git", "🌿", "Git / versões", "Histórico de tudo que já foi escrito"),
            b("monitoramento", "🩺", "Monitoramento", "Sensores: está tudo bem?"),
            b("logs", "📜", "Logs", "O diário de bordo da aplicação"),
            b("analytics", "📊", "Analytics", "O que os usuários fazem no app"),
            b("alertas", "🚨", "Alertas", "Acorda alguém quando algo cai"),
        ],
    },
    {
        id: "anotacoes",
        nome: "Anotações",
        icone: "📜",
        iconId: iconIdForEmoji("📜"),
        themeKey: "anotacoes",
        blocos: [
            {
                ...b("texto", "📜", "Texto", "Nota livre: escreva o que quiser"),
                defaultSize: { w: 240, h: 120 },
            },
        ],
    },
];
const INDEX = new Map();
for (const cat of CATEGORIAS) {
    for (const def of cat.blocos) {
        INDEX.set(def.id, { def, cat });
    }
}
export function resolveDef(id) {
    return INDEX.get(id);
}
