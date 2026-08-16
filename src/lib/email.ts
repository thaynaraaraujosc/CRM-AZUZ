import { Resend } from "resend";

/**
 * E-mail transacional da plataforma (recuperação de senha, e futuramente reenvio de convite) —
 * não confundir com `EmailSecao.tsx` (Configurações → E-mail), que é a conta de e-mail do
 * workspace pra falar com os leads. Esse aqui é da própria AZUZ, uma chave só, configurada por
 * variável de ambiente.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function emailConfigurado(): boolean {
  return resend !== null;
}

export async function enviarEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.error("RESEND_API_KEY não configurada — e-mail não enviado:", { to, subject });
    return;
  }
  const remetente = process.env.EMAIL_FROM || "CRM AZUZ <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from: remetente, to, subject, html });
  if (error) console.error("Falha ao enviar e-mail via Resend:", error);
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
      <p style="font-size: 13px; color: #6e7694;">Esse link expira em 1 hora. Se você não pediu essa redefinição, pode ignorar este e-mail — sua senha continua a mesma.</p>
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
      <p style="font-size: 13px; color: #6e7694;">Se você não fez essa alteração, entre em contato com a equipe AZUZ imediatamente — sua senha atual continua sendo a única forma de acessar a conta.</p>
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
