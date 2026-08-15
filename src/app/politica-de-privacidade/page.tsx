import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade · Azuz CRM" };

/**
 * Página pública exigida pela Meta pra publicar o App (WhatsApp Business, Instagram etc.) — sem
 * isso o app fica preso em "modo de desenvolvimento" pra sempre e nunca recebe webhook de mensagem
 * real, só eventos de teste manual do painel deles. Texto genérico de ponto de partida; revise com
 * um advogado se quiser algo mais específico do negócio antes de divulgar amplamente.
 */
export default function PoliticaDePrivacidadePage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "#0b1533", fontFamily: "sans-serif", lineHeight: 1.65 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Política de Privacidade — Azuz CRM</h1>
      <p style={{ color: "#5b6478", fontSize: 13, marginBottom: 32 }}>Última atualização: 14 de agosto de 2026</p>

      <p style={{ marginBottom: 20 }}>
        Esta política descreve como a Azuz Digital (&quot;Azuz CRM&quot;, &quot;nós&quot;) coleta, usa e protege
        os dados pessoais tratados através da plataforma, incluindo a integração com WhatsApp Business, Instagram
        e Meta Ads.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>1. Quais dados coletamos</h2>
      <p style={{ marginBottom: 20 }}>
        Coletamos os dados que você (empresa cliente) e seus contatos fornecem ao usar o CRM: nome, e-mail,
        telefone, mensagens trocadas via WhatsApp/Instagram, dados de negócios/funil de vendas e informações
        de uso da plataforma.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>2. Como usamos os dados</h2>
      <p style={{ marginBottom: 20 }}>
        Os dados são usados exclusivamente para operar o CRM da empresa cliente: centralizar conversas, organizar
        o funil de vendas, disparar automações e gerar relatórios. Não vendemos nem compartilhamos dados pessoais
        com terceiros para fins de publicidade.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>3. Integração com Meta (WhatsApp, Instagram, Ads)</h2>
      <p style={{ marginBottom: 20 }}>
        Quando uma empresa cliente conecta seu WhatsApp Business ou Instagram, o CRM recebe e armazena as
        mensagens trocadas com os contatos dela para exibição na própria plataforma. O token de acesso é
        armazenado de forma criptografada e usado apenas para operar a integração autorizada.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>4. Armazenamento e segurança</h2>
      <p style={{ marginBottom: 20 }}>
        Os dados ficam armazenados em banco de dados protegido, com acesso restrito à empresa cliente
        responsável por cada workspace. Senhas são armazenadas com hash criptográfico (nunca em texto puro) e
        tokens de integração são criptografados em repouso.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>5. Seus direitos</h2>
      <p style={{ marginBottom: 20 }}>
        Você pode solicitar a exclusão dos seus dados ou da sua conta a qualquer momento entrando em contato
        pelo e-mail abaixo.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>6. Contato</h2>
      <p>
        Dúvidas sobre esta política: <a href="mailto:ag.azuzdigital@gmail.com">ag.azuzdigital@gmail.com</a>
      </p>
    </div>
  );
}
