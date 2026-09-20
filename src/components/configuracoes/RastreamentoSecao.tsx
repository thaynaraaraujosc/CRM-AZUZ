"use client";

import { useEffect, useState } from "react";

import { CabecalhoCategoria } from "@/components/configuracoes/CabecalhoCategoria";
import { IconInstagram, IconWhatsApp } from "@/components/icons";

type Resposta = { link: string; temNumero: boolean; numero: string | null };
type Conversoes = {
  googleConectado: boolean;
  enviadas: number;
  aguardandoVenda: number;
  ultimoErro: string | null;
};

/**
 * Onde a pessoa pega o link que faz o rastreamento do Google funcionar.
 *
 * POR QUE É UM LINK E NÃO UM SCRIPT. O código do clique do Google só existe no navegador, na página
 * em que a pessoa caiu — e quando ela vai pro WhatsApp, esse código morre. Alguma coisa precisa
 * existir no site pra segurar a informação. Entre pedir pra instalar um script e pedir pra trocar o
 * endereço de um botão, só a segunda a maioria dos clientes vai conseguir fazer.
 *
 * A TELA É UMA COMPARAÇÃO, e a ordem é essa de propósito: primeiro o que JÁ FUNCIONA sem fazer
 * nada, depois o que exige uma ação. Quem abre esta tela precisa sair sabendo que metade do
 * trabalho já está feita, senão a impressão é de que nada funciona até ela configurar tudo.
 */
export function RastreamentoSecao() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [conversoes, setConversoes] = useState<Conversoes | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/rastreio/link")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .catch((erro) => console.error("Falha ao carregar o link de rastreamento:", erro));

    fetch("/api/rastreio/conversoes")
      .then((r) => (r.ok ? r.json() : null))
      .then(setConversoes)
      .catch((erro) => console.error("Falha ao carregar o estado das conversões:", erro));
  }, []);

  async function copiar() {
    if (!dados?.link) return;
    try {
      await navigator.clipboard.writeText(dados.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador que bloqueia a área de transferência: o campo continua selecionável na mão.
      setCopiado(false);
    }
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Rastreamento de anúncios"
        descricao="Saber de qual anúncio veio cada lead, e devolver a venda para a plataforma de anúncio, para que ela procure mais gente parecida com quem compra."
      />

      <div className="rastreio-canais">
        <div className="rastreio-canal rastreio-canal-pronto">
          <div className="rastreio-canal-h">
            <span className="rastreio-canal-icones">
              <IconWhatsApp width={18} height={18} />
              <IconInstagram width={18} height={18} />
            </span>
            <span className="rastreio-selo rastreio-selo-ativo">Funcionando</span>
          </div>
          <h4>Anúncios da Meta</h4>
          <p>
            Não precisa de nada. Quando alguém clica num anúncio do Facebook ou do Instagram e cai na
            sua conversa, a Meta informa de qual anúncio a pessoa veio, e o CRM guarda no contato.
          </p>
        </div>

        <div className="rastreio-canal">
          <div className="rastreio-canal-h">
            <span className="rastreio-canal-icones rastreio-google">G</span>
            <span className="rastreio-selo">Um passo</span>
          </div>
          <h4>Anúncios do Google</h4>
          <p>
            A pessoa clica no anúncio, passa pelo seu site e só depois vai pro WhatsApp. Nesse pulo a
            informação do anúncio se perde — a menos que o botão do site aponte para o seu link.
          </p>
        </div>

        {/* O terceiro caminho. Ele não tem passo nenhum pra quem manda o anúncio direto pro
            formulário, e é por isso que aparece como pronto: o Google e a Meta já penduram o código
            do clique no endereço final, e o formulário agora lê. */}
        <div className="rastreio-canal rastreio-canal-pronto">
          <div className="rastreio-canal-h">
            <span className="rastreio-canal-icones rastreio-google">F</span>
            <span className="rastreio-selo rastreio-selo-ativo">Funcionando</span>
          </div>
          <h4>Formulários do CRM</h4>
          <p>
            Se o seu anúncio leva direto pra um formulário do CRM, não precisa de nada: o código do
            clique vem no endereço e o formulário guarda sozinho. Se ele leva pra uma página sua que
            só depois mostra o formulário, o link pro formulário precisa carregar o que veio no
            endereço — é esse pulo que apaga a informação.
          </p>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Seu link de rastreamento</p>
        {dados ? (
          <>
            <div className="rastreio-link-linha">
              <input
                id="link-rastreado"
                className="input rastreio-link-campo"
                readOnly
                value={dados.link}
                aria-label="Seu link de rastreamento"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn primary" onClick={() => void copiar()}>
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            {dados.temNumero ? (
              <p className="hint rastreio-nota">
                Quem clicar cai no seu WhatsApp <strong>{dados.numero}</strong>, exatamente como
                antes. A diferença é que o CRM passa a saber de qual campanha a pessoa veio.
              </p>
            ) : (
              <p className="hint rastreio-nota rastreio-nota-alerta">
                Conecte um WhatsApp antes de usar este link. Sem número conectado ele não tem para
                onde mandar quem clicar.
              </p>
            )}
          </>
        ) : (
          <p className="hint rastreio-nota">Carregando…</p>
        )}
      </div>

      {/* A prestação de contas da devolução de vendas. Ela roda sozinha, no servidor, sem ninguém
          pedir — e recurso que roda escondido e não mostra resultado é indistinguível de recurso
          quebrado. Estes números são o que separa "está funcionando" de "parece que não faz nada". */}
      <div className="config-bloco">
        <p className="config-bloco-titulo">Vendas devolvidas para o Google</p>
        {conversoes === null ? (
          <p className="hint rastreio-nota">Carregando…</p>
        ) : !conversoes.googleConectado ? (
          <p className="hint rastreio-nota">
            Conecte o Google Ads em <strong>Outras integrações</strong> para que o CRM possa avisar
            o Google quando um lead vira venda. Sem isso ele continua otimizando para conseguir
            cliques, e não clientes.
          </p>
        ) : (
          <>
            <p className="rastreio-conversoes">
              <span>
                <strong>{conversoes.enviadas}</strong>{" "}
                {conversoes.enviadas === 1 ? "venda devolvida" : "vendas devolvidas"}
              </span>
              <span>
                <strong>{conversoes.aguardandoVenda}</strong>{" "}
                {conversoes.aguardandoVenda === 1 ? "lead esperando fechar" : "leads esperando fechar"}
              </span>
            </p>
            <p className="hint rastreio-nota">
              Quando você marca um negócio como <strong>ganho</strong> no funil, o CRM avisa o Google
              qual clique gerou aquela venda e quanto ela valeu. O envio acontece sozinho, em até
              meia hora. Na primeira vez, o CRM cria na sua conta do Google Ads uma conversão
              chamada <strong>“Venda · CRM AZUZ”</strong> — é ela que recebe esses valores.
            </p>
            {conversoes.ultimoErro ? (
              <p className="hint rastreio-nota rastreio-nota-alerta">
                O Google recusou o último envio: {conversoes.ultimoErro}
              </p>
            ) : null}
            {/* A Meta não entra aqui, e a tela diz isso em vez de omitir. Omitir faria parecer que
                a devolução cobre os dois canais, que é o tipo de promessa pela metade que já
                existiu nesta tela antes. */}
            <p className="hint rastreio-nota">
              <strong>Só para o Google por enquanto.</strong> A Meta exige uma permissão de anúncios
              que ainda não foi liberada para este app. Enquanto isso, o lead que vem do Facebook e
              do Instagram continua sendo rastreado normalmente — o que não acontece é a venda
              voltar para lá.
            </p>
          </>
        )}
      </div>

      <div className="config-bloco rastreio-passos">
        <p className="config-bloco-titulo">Como instalar, em três passos</p>
        <ol>
          <li>
            <strong>Copie o link acima.</strong>
          </li>
          <li>
            <strong>Abra o editor do seu site</strong> e encontre o botão ou link de WhatsApp.
          </li>
          <li>
            <strong>Troque o endereço dele por esse.</strong> No Wix, no WordPress e no Shopify isso
            é um campo de texto na edição do botão — não é preciso mexer em código. Se houver mais de
            um botão na página, troque todos.
          </li>
        </ol>
      </div>
    </div>
  );
}
