import { Resend } from "resend";

/**
 * E-mail transacional da plataforma: recuperação de senha, aviso de e-mail alterado, convite de
 * equipe e o bloco "Enviar e-mail" das automações. Uma chave só, da própria AZUZ, configurada por
 * variável de ambiente.
 *
 * Existia uma tela em Configurações que prometia conectar a caixa de entrada de cada workspace
 * pra receber e responder e-mail de lead dentro do CRM. Ela não conectava nada, e saiu: receber
 * e-mail não faz parte do produto. ENVIAR faz, e é isto aqui, que continua valendo.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function emailConfigurado(): boolean {
  return resend !== null;
}

/**
 * Manda um e-mail e DIZ se deu certo, em português, sem estourar.
 *
 * As duas funções que já existiam aqui cobrem os extremos: `enviarEmail` engole a falha (certo pro
 * e-mail de sistema, que não pode derrubar o fluxo) e `enviarEmailOuFalhar` estoura (certo pra
 * campanha, onde a linha do destinatário precisa ficar marcada como falhou).
 *
 * O convite de equipe não é nenhum dos dois. Se o e-mail não sai, o membro AINDA ASSIM precisa ser
 * criado, com o link de convite pronto pra ser mandado por WhatsApp; mas a tela precisa dizer que
 * o e-mail não saiu, em vez de mostrar "convite pendente" e deixar todo mundo esperando um e-mail
 * que nunca vai chegar. Foi exatamente isso que aconteceu.
 *
 * A causa mais comum, e a que mais engana: sem um domínio próprio verificado, o remetente cai no
 * `onboarding@resend.dev`, e desse endereço o Resend só entrega pro dono da conta. Convite pra
 * qualquer outra pessoa é recusado. A recusa vinha, ia pro log do servidor, e ninguém via.
 */
export async function enviarEmailContandoFalha({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!resend) {
    return { ok: false, motivo: "O envio de e-mail não está configurado no servidor (RESEND_API_KEY)." };
  }
  const remetente = process.env.EMAIL_FROM || "CRM AZUZ <onboarding@resend.dev>";
  try {
    const { error } = await resend.emails.send({ from: remetente, to, subject, html });
    if (!error) return { ok: true };

    const bruto = error.message || "o provedor recusou o envio";
    // A recusa do domínio de teste é a mais frequente e a mais difícil de entender pela mensagem
    // crua, que vem em inglês e fala de "testing emails". Aqui ela vira instrução.
    const ehDominioDeTeste = /only send testing emails|your own email address|verify a domain/i.test(bruto);
    return {
      ok: false,
      motivo: ehDominioDeTeste
        ? "O remetente ainda é o endereço de teste do provedor, e dele só dá pra enviar pro dono da conta. Pra mandar pra outras pessoas é preciso verificar um domínio próprio no Resend e configurar EMAIL_FROM."
        : bruto,
    };
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : "falha ao falar com o provedor de e-mail" };
  }
}

export async function enviarEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.error("RESEND_API_KEY não configurada: e-mail não enviado:", { to, subject });
    return;
  }
  const remetente = process.env.EMAIL_FROM || "CRM AZUZ <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from: remetente, to, subject, html });
  if (error) console.error("Falha ao enviar e-mail via Resend:", error);
}

/**
 * Manda um e-mail e ESTOURA se falhar.
 *
 * `enviarEmail` acima engole o erro de propósito: ela nasceu pros e-mails de sistema (redefinir
 * senha, convite), onde derrubar o fluxo por causa de um e-mail seria pior que registrar a falha.
 *
 * Campanha é o caso oposto: se a mensagem não saiu, aquele destinatário precisa ficar marcado como
 * falhou, com o motivo: senão o relatório diz "enviado" para gente que nunca recebeu nada, que é a
 * pior coisa que um sistema de disparo pode fazer.
 */
export async function enviarEmailOuFalhar({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend) throw new Error("Envio de e-mail não está configurado no servidor (RESEND_API_KEY).");
  const remetente = process.env.EMAIL_FROM || "CRM AZUZ <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from: remetente, to, subject, html });
  if (error) throw new Error(error.message || "Falha ao enviar e-mail.");
}

export function templateRedefinicaoSenha(nome: string, link: string): string {
  const primeiroNome = nome.split(" ")[0];
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0b1533;">Redefinir sua senha</h2>
      <p>Olá, ${primeiroNome}.</p>
      <p>Recebemos um pedido pra redefinir a senha da sua conta no CRM AZUZ. Clique no botão abaixo pra escolher uma nova senha:</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background: #2e6bff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Redefinir senha
        </a>
      </p>
      <p style="font-size: 13px; color: #6e7694;">Esse link expira em 1 hora. Se você não pediu essa redefinição, pode ignorar este e-mail: sua senha continua a mesma.</p>
    </div>
  `;
}

export function templateEmailAlterado(nome: string, novoEmail: string): string {
  const primeiroNome = nome.split(" ")[0];
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0b1533;">Seu e-mail de acesso foi alterado</h2>
      <p>Olá, ${primeiroNome}.</p>
      <p>O e-mail de acesso da sua conta no CRM AZUZ foi alterado para <strong>${novoEmail}</strong>. A partir de agora, use esse novo e-mail (com sua senha atual) pra entrar.</p>
      <p style="font-size: 13px; color: #6e7694;">Se você não fez essa alteração, entre em contato com a equipe AZUZ imediatamente. Sua senha atual continua sendo a única forma de acessar a conta.</p>
    </div>
  `;
}

export function templateConvite(nome: string, workspaceNome: string, link: string): string {
  const primeiroNome = nome.split(" ")[0];
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0b1533;">Você foi convidado(a)</h2>
      <p>Olá, ${primeiroNome}.</p>
      <p>Você foi convidado(a) pra fazer parte do CRM da <strong>${workspaceNome}</strong>. Clique no botão abaixo pra criar sua senha e começar a usar:</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background: #2e6bff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Aceitar convite
        </a>
      </p>
      <p style="font-size: 13px; color: #6e7694;">Se você não esperava esse convite, pode ignorar este e-mail.</p>
    </div>
  `;
}
