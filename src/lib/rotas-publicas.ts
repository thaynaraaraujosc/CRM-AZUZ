/**
 * As rotas que NÃO exigem sessão de navegador.
 *
 * Isto morava dentro do `proxy.ts`, no meio de uma condição de dez linhas, e o mesmo erro já foi
 * cometido três vezes: a rota da Evolution mudou de nome e a exceção não acompanhou (nenhuma
 * mensagem espelhava no CRM); o cron de saúde do WhatsApp nunca entrou na lista; e o cron das
 * campanhas nasceu de fora dela. Disparava no horário certo, respondia 307 pro /login e a rota
 * nunca executava. Os três sintomas foram idênticos e nenhum apareceu como erro: a coisa
 * simplesmente não acontecia.
 *
 * Separado num arquivo com teste, esquecer de incluir uma rota nova deixa de ser silencioso.
 *
 * IMPORTANTE: nada aqui fica sem defesa. O que muda é ONDE ela mora. Quem entra nesta lista é
 * chamado por um sistema, não por uma pessoa, e se defende dentro da própria rota: assinatura HMAC
 * nos webhooks da Meta, token fixo na Evolution e na Asaas, `CRON_SECRET` nos crons.
 */

/** Prefixos: a rota e tudo abaixo dela. */
const PREFIXOS_PUBLICOS = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/formulario-preview",
  // A tela pública do formulário, aberta pelo link compartilhado. Quem chega aqui é um lead que
  // nunca vai ter login: exigir sessão devolveria um 307 pro /login e o formulário jamais seria
  // respondido. Ela só desenha o formulário e chama as rotas de `/api/formularios`, que já são
  // públicas e já devolvem o mínimo.
  "/f",
  "/acesso-bloqueado",
  "/politica-de-privacidade",
  "/api/auth",
  "/api/formularios",
  "/api/convite",
  // Cron da plataforma. Quem chama é o agendador da hospedagem, que não tem navegador nem sessão.
  // A defesa é o `CRON_SECRET` conferido dentro de cada rota.
  "/api/cron/",
];

/** Caminhos exatos: sem nada abaixo deles. */
const EXATOS_PUBLICOS = [
  // A landing. Precisa ser exata: "/" é prefixo de todo o resto do site.
  "/",
  "/api/cadastro",
  // Chamados direto pela Meta (verificação do webhook + mensagens recebidas). A assinatura HMAC
  // dentro da rota é o que garante que é a Meta, não o proxy.
  "/api/webhooks/whatsapp",
  "/api/webhooks/instagram",
  // Evolution API (serviço separado, sessão por QR Code), validada por segredo dentro da rota.
  "/api/webhooks/evolution",
  // Asaas (eventos de cobrança da assinatura), validada pelo `asaas-access-token` na rota.
  "/api/webhooks/asaas",
  // Verificação diária das conexões oficiais, chamada pelo cron: mesma regra dos `/api/cron/`,
  // só que esta rota nasceu antes dessa pasta existir.
  "/api/integracoes/meta/whatsapp/saude",
  // Ícone e imagem de compartilhamento, geradas pelo Next a partir de `icon.tsx`,
  // `apple-icon.tsx` e `opengraph-image.tsx`.
  //
  // Quem busca estes endereços é o navegador montando a aba, o iPhone salvando o atalho e o
  // servidor do WhatsApp montando a prévia do link: nenhum deles tem sessão. Sem a liberação o
  // proxy respondia 307 pro /login, e imagem que responde redirecionamento é o mesmo que imagem
  // nenhuma. Não vaza nada: são desenhos fixos com o nome do produto.
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
  "/favicon.ico",
];

export function ehRotaPublica(pathname: string): boolean {
  if (EXATOS_PUBLICOS.includes(pathname)) return true;
  return PREFIXOS_PUBLICOS.some(
    (rota) => pathname === rota || pathname.startsWith(rota.endsWith("/") ? rota : `${rota}/`),
  );
}
