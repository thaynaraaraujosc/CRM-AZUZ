import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exclusão de dados · Azuz CRM" };

/**
 * Página pública de instruções de exclusão de dados.
 *
 * Exigida pela Meta na revisão do App: o painel pede uma "Data Deletion Instructions URL" (ou um
 * callback) e não deixa publicar sem ela. Sem publicar, o app fica preso em modo de
 * desenvolvimento, e em modo de desenvolvimento só contas convidadas como testadoras conseguem
 * conectar. Que é exatamente o problema de "meu cliente não consegue conectar o Instagram dele".
 *
 * Não é texto decorativo: descreve o que o produto faz de verdade hoje (desconectar apaga o
 * espelho do canal, excluir a conta apaga o workspace) e por onde pedir o que não é self-service.
 */
const ESTILO_H2 = { fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 } as const;
const ESTILO_P = { marginBottom: 20 } as const;

export default function ExclusaoDeDadosPage() {
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
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Exclusão de dados do Azuz CRM</h1>
      <p style={{ color: "#5b6478", fontSize: 13, marginBottom: 32 }}>Última atualização: 13 de setembro de 2026</p>

      <p style={ESTILO_P}>
        Esta página explica como excluir os dados tratados pelo Azuz CRM, incluindo os dados obtidos
        pelas integrações com WhatsApp Business, Instagram e Meta Ads. Vale tanto para a empresa
        cliente quanto para qualquer pessoa que tenha conversado com ela pelos canais conectados.
      </p>

      <h2 style={ESTILO_H2}>1. Desconectar um canal apaga o que veio dele</h2>
      <p style={ESTILO_P}>
        Dentro do CRM, em Configurações e Integrações, ao desconectar o WhatsApp ou o Instagram você
        escolhe se quer apagar junto o que aquele canal trouxe: conversas, mensagens, contatos
        criados automaticamente e os negócios de funil desses contatos. A exclusão é imediata e não
        tem como desfazer. Contatos e negócios criados à mão permanecem, porque não vieram do canal.
      </p>

      <h2 style={ESTILO_H2}>2. Excluir um contato específico</h2>
      <p style={ESTILO_P}>
        Em Contatos, abra o contato e use excluir. Isso remove o cadastro da pessoa e os negócios
        ligados a ela. Para apagar também o histórico de conversa, exclua a conversa correspondente
        na tela de Conversas.
      </p>

      <h2 style={ESTILO_H2}>3. Excluir a conta inteira</h2>
      <p style={ESTILO_P}>
        Para encerrar a conta e apagar todos os dados da empresa, escreva para{" "}
        <a href="mailto:contato@azuzdigital.com.br" style={{ color: "#2d4a8a" }}>
          contato@azuzdigital.com.br
        </a>{" "}
        a partir do e-mail do administrador da conta, pedindo a exclusão. Nós confirmamos a
        identidade, executamos a exclusão em até 30 dias e avisamos quando estiver concluída.
      </p>

      <h2 style={ESTILO_H2}>4. Se você conversou com uma empresa que usa o Azuz CRM</h2>
      <p style={ESTILO_P}>
        Nesse caso a empresa é quem controla os seus dados, e nós apenas operamos a ferramenta que
        ela usa. Peça a exclusão diretamente a ela, que consegue fazer isso sozinha pelos caminhos
        acima. Se preferir, escreva para o nosso e-mail que encaminhamos o pedido para a empresa
        responsável e acompanhamos até a conclusão.
      </p>

      <h2 style={ESTILO_H2}>5. O que é mantido depois da exclusão</h2>
      <p style={ESTILO_P}>
        Registros mínimos de segurança e de cobrança podem ser mantidos pelo prazo que a lei exige,
        sem conteúdo de mensagens. Tokens de acesso das integrações são apagados imediatamente na
        desconexão e deixam de valer.
      </p>

      <p style={{ marginTop: 36, fontSize: 13, color: "#5b6478" }}>
        Veja também a{" "}
        <Link href="/politica-de-privacidade" style={{ color: "#2d4a8a" }}>
          Política de Privacidade
        </Link>{" "}
        e os{" "}
        <Link href="/termos" style={{ color: "#2d4a8a" }}>
          Termos de Uso
        </Link>
        .
      </p>
    </div>
  );
}
