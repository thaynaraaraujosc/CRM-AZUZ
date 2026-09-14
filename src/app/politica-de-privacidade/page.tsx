import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade · Azuz CRM" };

/**
 * Página pública exigida pela Meta pra publicar o App (WhatsApp Business, Instagram etc.): sem
 * isso o app fica preso em "modo de desenvolvimento" pra sempre e nunca recebe webhook de mensagem
 * real, só eventos de teste manual do painel deles. Texto genérico de ponto de partida; revise com
 * um advogado se quiser algo mais específico do negócio antes de divulgar amplamente.
 *
 * O GOOGLE TAMBÉM EXIGE, e é mais rigoroso que a Meta no conteúdo. Pra verificar um app que usa
 * escopo sensível (o `adwords`, do Google Ads), a análise confere se esta página:
 *
 * - está no MESMO domínio registrado no app e acessível sem login;
 * - diz explicitamente QUAIS dados do Google são acessados, e pra quê;
 * - contém a declaração de conformidade com a Política de Dados do Usuário, incluindo os
 *   requisitos de USO LIMITADO — essa frase é procurada quase literalmente;
 * - explica como a pessoa revoga o acesso.
 *
 * Política que não diz nada sobre o Google é a causa mais comum de recusa, e a recusa custa o
 * ciclo inteiro de análise de novo. Por isso a seção 4 existe e é específica: texto genérico de
 * "respeitamos sua privacidade" não passa.
 */
export default function PoliticaDePrivacidadePage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "#0b1533", fontFamily: "sans-serif", lineHeight: 1.65 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Política de Privacidade do Azuz CRM</h1>
      <p style={{ color: "#5b6478", fontSize: 13, marginBottom: 32 }}>Última atualização: 14 de setembro de 2026</p>

      <p style={{ marginBottom: 20 }}>
        Esta política descreve como a Azuz Digital (&quot;Azuz CRM&quot;, &quot;nós&quot;) coleta, usa e protege
        os dados pessoais tratados através da plataforma, incluindo as integrações com WhatsApp Business,
        Instagram, Meta Ads e Google Ads.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>1. Quais dados coletamos</h2>
      <p style={{ marginBottom: 20 }}>
        Coletamos os dados que você (empresa cliente) e seus contatos fornecem ao usar o CRM: nome, e-mail,
        telefone, mensagens trocadas via WhatsApp/Instagram, dados de negócios/funil de vendas, métricas das
        contas de anúncio conectadas e informações de uso da plataforma.
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

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>4. Integração com Google Ads</h2>
      <p style={{ marginBottom: 20 }}>
        Quando uma empresa cliente conecta sua conta do Google Ads, o Azuz CRM solicita autorização pelo
        Google (OAuth 2.0) com o escopo <code>https://www.googleapis.com/auth/adwords</code>, em modo de
        somente leitura na prática: o CRM lê, e não cria, edita, pausa nem exclui nada nas campanhas.
      </p>
      <p style={{ marginBottom: 20 }}>
        <strong>Quais dados lemos.</strong> Apenas o desempenho agregado das campanhas dos últimos 30 dias:
        nome e identificador da campanha, investimento, número de conversões, categoria da conversão e valor
        de conversão. Não lemos, importamos nem armazenamos listas de público, dados de pessoas que viram ou
        clicaram nos anúncios, dados de pagamento, nem o conteúdo da conta Google de quem autoriza.
      </p>
      <p style={{ marginBottom: 20 }}>
        <strong>Pra que usamos.</strong> Exclusivamente para exibir, na tela de Tráfego do CRM da própria
        empresa cliente, o investimento em anúncios ao lado dos leads e das vendas que ela já registra no
        CRM — o que permite calcular custo por lead, custo por venda e retorno sobre o investimento. Os dados
        são mostrados apenas para os usuários do workspace daquela empresa.
      </p>
      <p style={{ marginBottom: 20 }}>
        <strong>Como guardamos.</strong> Os tokens de autorização do Google são armazenados criptografados em
        repouso e usados somente para operar a integração autorizada. Não vendemos, alugamos nem transferimos
        dados obtidos das APIs do Google a terceiros, e não os usamos para publicidade, para treinar modelos de
        inteligência artificial nem para qualquer finalidade alheia à funcionalidade descrita acima. Nenhum
        operador humano lê esses dados, salvo com consentimento expresso da empresa cliente, para suporte ou
        depuração de um problema por ela relatado, ou quando exigido por lei.
      </p>
      <p style={{ marginBottom: 20 }}>
        <strong>Uso Limitado.</strong> O uso e a transferência, pelo Azuz CRM, de informações recebidas das APIs
        do Google obedecem à{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>
      <p style={{ marginBottom: 20 }}>
        <strong>Como revogar.</strong> A empresa cliente pode desconectar o Google Ads a qualquer momento na
        tela de Tráfego do CRM, o que apaga os tokens guardados. O acesso também pode ser removido diretamente
        pelo Google, em{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>5. Armazenamento e segurança</h2>
      <p style={{ marginBottom: 20 }}>
        Os dados ficam armazenados em banco de dados protegido, com acesso restrito à empresa cliente
        responsável por cada workspace. Senhas são armazenadas com hash criptográfico (nunca em texto puro) e
        tokens de integração são criptografados em repouso.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>6. Seus direitos</h2>
      <p style={{ marginBottom: 20 }}>
        Você pode solicitar a exclusão dos seus dados ou da sua conta a qualquer momento entrando em contato
        pelo e-mail abaixo.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 8 }}>7. Contato</h2>
      <p>
        Dúvidas sobre esta política: <a href="mailto:ag.azuzdigital@gmail.com">ag.azuzdigital@gmail.com</a>
      </p>
    </div>
  );
}
