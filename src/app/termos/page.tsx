import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Uso · Azuz CRM" };

/**
 * Termos de uso públicos.
 *
 * Exigidos pela Meta na revisão do App: o painel pede uma "Terms of Service URL" junto com a
 * política de privacidade, e é esse par que aparece no rodapé do diálogo de permissão do Instagram
 * ("CRM-IG Política de Privacidade e Termos"). Sem os dois, o app não sai do modo de
 * desenvolvimento, e em modo de desenvolvimento só contas convidadas como testadoras conseguem
 * conectar.
 *
 * Ponto de partida honesto, descrevendo o que o produto faz hoje. Revise com um advogado antes de
 * vender em escala: isto cobre a exigência técnica da Meta, não substitui consultoria jurídica.
 */
const ESTILO_H2 = { fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 } as const;
const ESTILO_P = { marginBottom: 20 } as const;

export default function TermosPage() {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 80px",
        color: "#0b1533",
        fontFamily: "sans-serif",
        lineHeight: 1.65,
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Termos de Uso do Azuz CRM</h1>
      <p style={{ color: "#5b6478", fontSize: 13, marginBottom: 32 }}>Última atualização: 13 de setembro de 2026</p>

      <p style={ESTILO_P}>
        Estes termos regem o uso do Azuz CRM, plataforma operada pela Azuz Digital. Ao criar uma
        conta ou usar a plataforma, você concorda com o que está descrito aqui.
      </p>

      <h2 style={ESTILO_H2}>1. O que a plataforma faz</h2>
      <p style={ESTILO_P}>
        O Azuz CRM centraliza o atendimento e o acompanhamento comercial de uma empresa: conversas
        de WhatsApp e Instagram Direct, funil de vendas, contatos, formulários, automações e
        relatórios. Cada empresa cliente trabalha em um espaço isolado, sem acesso aos dados de
        outra.
      </p>

      <h2 style={ESTILO_H2}>2. Conta e responsabilidade</h2>
      <p style={ESTILO_P}>
        A empresa cliente é responsável pelas contas de acesso que cria, pelo conteúdo que envia aos
        próprios contatos e por usar a plataforma dentro da lei, incluindo a Lei Geral de Proteção
        de Dados. Senhas são pessoais e não devem ser compartilhadas.
      </p>

      <h2 style={ESTILO_H2}>3. Integrações com Meta e WhatsApp</h2>
      <p style={ESTILO_P}>
        Ao conectar WhatsApp Business, Instagram ou Meta Ads, a empresa autoriza o CRM a receber e
        exibir as mensagens e os dados daquele canal. O uso dessas integrações também está sujeito
        às regras da Meta, e o descumprimento delas pode levar ao bloqueio do canal pela própria
        Meta, fora do nosso controle. Disparo de mensagem não solicitada é proibido.
      </p>

      <h2 style={ESTILO_H2}>4. Assinatura e pagamento</h2>
      <p style={ESTILO_P}>
        O acesso depende de assinatura ativa. A cobrança é mensal e recorrente. Em caso de atraso ou
        cancelamento, o acesso é suspenso, e os dados permanecem guardados pelo prazo descrito na
        Política de Privacidade antes de serem removidos. O cancelamento pode ser feito a qualquer
        momento dentro da plataforma.
      </p>

      <h2 style={ESTILO_H2}>5. Disponibilidade</h2>
      <p style={ESTILO_P}>
        Trabalhamos para manter a plataforma disponível, mas ela depende de serviços de terceiros
        (Meta, provedores de mensagem, hospedagem) que podem falhar ou mudar suas regras. Não
        garantimos funcionamento ininterrupto nem nos responsabilizamos por indisponibilidade
        causada por esses serviços.
      </p>

      <h2 style={ESTILO_H2}>6. Encerramento</h2>
      <p style={ESTILO_P}>
        A empresa cliente pode encerrar a conta quando quiser. Podemos suspender contas que violem
        estes termos, as regras da Meta ou a lei. Sobre exclusão de dados, veja a{" "}
        <Link href="/exclusao-de-dados" style={{ color: "#2d4a8a" }}>
          página de exclusão de dados
        </Link>
        .
      </p>

      <h2 style={ESTILO_H2}>7. Contato</h2>
      <p style={ESTILO_P}>
        Dúvidas sobre estes termos:{" "}
        <a href="mailto:contato@azuzdigital.com.br" style={{ color: "#2d4a8a" }}>
          contato@azuzdigital.com.br
        </a>
        .
      </p>

      <p style={{ marginTop: 36, fontSize: 13, color: "#5b6478" }}>
        Veja também a{" "}
        <Link href="/politica-de-privacidade" style={{ color: "#2d4a8a" }}>
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
}
