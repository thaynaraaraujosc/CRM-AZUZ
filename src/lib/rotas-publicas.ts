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
  // O anexo assinado que a Meta e a Evolution buscam pra montar a mensagem de mídia.
  //
  // A rota SEMPRE foi escrita pra não exigir sessão (é o que o comentário dela diz), mas nunca
  // entrou nesta lista, e é exatamente o terceiro sintoma descrito no topo deste arquivo: o proxy
  // devolvia 307 pro /login, a Meta recebia uma página de login em vez do arquivo, e a mensagem de
  // imagem ou de áudio simplesmente não chegava. Sem erro em lugar nenhum, porque do ponto de
  // vista do CRM o envio tinha sido aceito.
  //
  // A defesa mora dentro da rota e não some por estar aqui: id aleatório de 16 bytes, assinatura
  // HMAC do id (`?a=`) conferida antes de tocar no banco, e validade de 15 minutos.
  "/api/anexos/publico",
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
];

/**
 * Os arquivos de identidade que o Next serve na raiz: ícone da aba, ícone do iPhone e imagem de
 * compartilhamento.
 *
 * Regra e não lista fixa porque o ENDEREÇO MUDA conforme a forma do arquivo: gerado por código
 * (`icon.tsx`) ele responde em `/icon`; sendo uma imagem (`icon.png`) ele responde em `/icon.png`.
 * Já aconteceu duas vezes de a liberação cobrir só uma das formas e o proxy devolver 307 pro
 * /login: imagem que responde redirecionamento é o mesmo que imagem nenhuma, e o build não acusa,
 * porque a rota compila certo dos dois jeitos.
 *
 * Quem busca estes endereços é o navegador montando a aba, o iPhone salvando o atalho e o servidor
 * do WhatsApp montando a prévia do link. Nenhum deles tem sessão, e não há o que vazar: é a marca
 * do produto, publicada de propósito.
 */
const ARQUIVOS_DE_MARCA = /^\/(icon|apple-icon|opengraph-image|twitter-image|favicon)(-\w+)?(\.\w+)?$/;

export function ehRotaPublica(pathname: string): boolean {
  if (ARQUIVOS_DE_MARCA.test(pathname)) return true;
  if (EXATOS_PUBLICOS.includes(pathname)) return true;
  return PREFIXOS_PUBLICOS.some(
    (rota) => pathname === rota || pathname.startsWith(rota.endsWith("/") ? rota : `${rota}/`),
  );
}
