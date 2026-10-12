/**
 * Dicionário português → inglês da interface.
 *
 * A CHAVE É O PRÓPRIO TEXTO EM PORTUGUÊS, de propósito. A alternativa (chaves tipo
 * `conversas.busca.placeholder`) obrigaria a inventar e manter um nome para cada frase do sistema,
 * e a tela deixaria de ser legível: `{t("conversas.vazio.titulo")}` não diz o que aparece ali.
 * Com a frase como chave, o código continua se lendo em português e a tradução é um acréscimo.
 *
 * E o mais importante: **frase sem tradução aqui aparece em português, nunca em branco nem com
 * erro.** Isso faz a cobertura ser incremental e sem risco — traduzir a próxima tela é acrescentar
 * linhas aqui, e esquecer uma frase degrada para o idioma original em vez de quebrar a interface.
 *
 * Vale também para texto que vem do servidor: rótulo de métrica nasce em português na API
 * (`instagram-metricas.ts`) e é traduzido aqui na hora de desenhar, sem precisar de idioma no
 * backend.
 *
 * O inglês existe por causa da análise da Meta, que pede a interface em inglês no screencast e cujo
 * analista entra no CRM para testar. O padrão é e continua sendo o português.
 */
export const TRADUCOES_EN: Record<string, string> = {
  // ---- Seletor de idioma ----
  Idioma: "Language",
  Português: "Portuguese",
  Inglês: "English",

  // ---- Métricas da conta (rótulos vindos da API, ver instagram-metricas.ts) ----
  "Contas alcançadas": "Accounts reached",
  "Quantas contas diferentes viram algum conteúdo seu.":
    "How many different accounts saw any of your content.",
  "Contas que interagiram": "Accounts engaged",
  "Quantas contas curtiram, comentaram, salvaram ou compartilharam.":
    "How many accounts liked, commented, saved or shared.",
  Interações: "Interactions",
  "Curtidas, comentários, salvamentos e compartilhamentos somados.":
    "Likes, comments, saves and shares combined.",
  "Visitas ao perfil": "Profile views",
  "Quantas vezes seu perfil foi aberto.": "How many times your profile was opened.",

  // ---- Menu do módulo Social ----
  "Seções do Instagram": "Instagram sections",
  Automações: "Automations",
  "Resposta automática": "Auto-reply",
  "Meus Templates": "My templates",
  Painel: "Dashboard",
  Execuções: "Runs",

  // ---- Painel Social (Automações > Social > Painel) ----
  Social: "Social",
  "Instagram: o que chegou, o que os robôs fizeram e o que a Meta informa":
    "Instagram: what came in, what the bots did and what Meta reports",
  "7 dias": "7 days",
  "30 dias": "30 days",
  "90 dias": "90 days",

  "O Instagram não está conectado.": "Instagram is not connected.",
  "Os números do CRM abaixo continuam valendo pro que já foi registrado.":
    "The CRM numbers below still apply to everything already recorded.",
  "Ver conexões": "View connections",

  "O que o CRM registrou": "What the CRM recorded",
  "Contado neste banco, nos últimos {dias} dias. É exato: cada número aqui é uma linha que existe.":
    "Counted in this database, over the last {dias} days. It is exact: every number here is a row that exists.",
  "Carregando…": "Loading…",
  "Não deu pra carregar agora.": "Could not load right now.",
  "Mensagens no Direct": "Direct messages",
  Comentários: "Comments",
  "Respostas a story": "Story replies",
  "Menções em story": "Story mentions",
  "Reações recebidas": "Reactions received",
  "Leads criados pelo Instagram": "Leads created from Instagram",
  "Automações sociais iniciadas": "Social automations started",

  "O que o Instagram informa": "What Instagram reports",
  "Vem da API da Meta. Depende do tipo da conta e das permissões concedidas, então pode faltar item: o que ela recusa aparece abaixo, com o motivo dela.":
    "This comes from Meta's API. It depends on the account type and on the permissions granted, so items may be missing: whatever Meta declines is listed below, with its reason.",
  Seguidores: "Followers",
  Publicações: "Posts",
  "Perfil: {erro}": "Profile: {erro}",
  "Não disponíveis nesta conta:": "Not available on this account:",
  "Não deu pra falar com a Meta agora.": "Could not reach Meta right now.",

  "Seus robôs do Instagram": "Your Instagram bots",
  "O acompanhamento do Instagram é aqui, não no funil. Quem chega pelo Direct vira contato, com @, foto e etiqueta, e não vira card: o funil comercial é do WhatsApp. Cada linha abaixo é um robô, contado em execução de verdade nos últimos {dias} dias.":
    "Instagram is tracked here, not in the sales pipeline. People who arrive through Direct become contacts, with handle, picture and tag, and do not become pipeline cards: the sales pipeline belongs to WhatsApp. Each row below is a bot, counted on real runs over the last {dias} days.",
  Robô: "Bot",
  Situação: "Status",
  Rodou: "Runs",
  "Em andamento": "In progress",
  Erros: "Errors",
  "Última vez": "Last run",
  Ligado: "On",
  Desligado: "Off",
  "Nenhum robô de Instagram ainda.": "No Instagram bots yet.",
  "Abrir automações": "Open automations",
  "Ver execuções e erros": "View runs and errors",
  "Contatos do Instagram": "Instagram contacts",
};
