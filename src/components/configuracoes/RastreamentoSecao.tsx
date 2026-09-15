"use client";

import { useEffect, useState } from "react";

import { CabecalhoCategoria } from "@/components/configuracoes/CabecalhoCategoria";

type Resposta = { link: string; temNumero: boolean; numero: string | null };

/**
 * Onde a pessoa pega o link que faz o rastreamento do Google funcionar.
 *
 * POR QUE ISTO É UM LINK E NÃO UM SCRIPT. O código do clique do Google só existe no navegador, na
 * página em que a pessoa caiu — e quando ela vai pro WhatsApp, esse código morre. Alguma coisa
 * precisa existir no site pra segurar essa informação. Entre pedir pra instalar um script e pedir
 * pra trocar o endereço de um botão, a segunda é a única que a maioria dos clientes vai conseguir
 * fazer: trocar link de botão é coisa de Wix e WordPress, sem programador e sem risco de quebrar
 * a página.
 *
 * A TELA DIZ O QUE JÁ FUNCIONA SEM NADA. A parte da Meta não precisa deste link nem de coisa
 * nenhuma, e quem chega aqui precisa saber disso antes de achar que tem trabalho a fazer.
 */
export function RastreamentoSecao() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/rastreio/link")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .catch((erro) => console.error("Falha ao carregar o link de rastreamento:", erro));
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
    <>
      <CabecalhoCategoria
        titulo="Rastreamento de anúncios"
        descricao="Saber de qual anúncio veio cada lead, e devolver a venda pra plataforma."
      />

      <div className="config-bloco">
        <h4>Anúncios da Meta</h4>
        <p className="hint">
          Já está funcionando, e não precisa de nada. Quando alguém clica num anúncio do Facebook ou
          do Instagram e cai na sua conversa, a Meta manda junto de qual anúncio a pessoa veio — e o
          CRM guarda isso no contato automaticamente.
        </p>
      </div>

      <div className="config-bloco">
        <h4>Anúncios do Google</h4>
        <p className="hint">
          O Google é diferente: a pessoa clica no anúncio, passa pelo seu site, e só depois vai pro
          WhatsApp. Nesse pulo a informação do anúncio se perde. Pra não perder, o botão de WhatsApp
          do site precisa apontar pra este endereço em vez de apontar direto pro WhatsApp:
        </p>

        {dados ? (
          <>
            <div className="field">
              <label htmlFor="link-rastreado">Seu link</label>
              <input id="link-rastreado" className="input" readOnly value={dados.link} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="config-acoes">
              <button type="button" className="btn primary" onClick={() => void copiar()}>
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            {!dados.temNumero ? (
              <p className="hint" style={{ color: "var(--danger)" }}>
                Conecte um WhatsApp antes de usar este link. Sem número conectado ele não tem pra
                onde mandar quem clicar.
              </p>
            ) : (
              <p className="hint">
                Quem clicar cai no seu WhatsApp ({dados.numero}), como antes. A diferença é que o CRM
                passa a saber de qual campanha a pessoa veio.
              </p>
            )}
          </>
        ) : (
          <p className="hint">Carregando…</p>
        )}
      </div>

      <div className="config-bloco admin-bloco-info">
        <h4>Onde colar</h4>
        <p className="hint">
          No site, procure o botão ou link de WhatsApp e troque o endereço dele por esse. No Wix, no
          WordPress e no Shopify isso é um campo de texto na edição do botão — não precisa mexer em
          código. Se você tiver mais de um botão na página, troque todos.
        </p>
      </div>
    </>
  );
}
