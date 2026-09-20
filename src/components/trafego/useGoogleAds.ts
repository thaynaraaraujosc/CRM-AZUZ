import { useEffect, useState } from "react";

import type { Campanha } from "@/lib/data";

export type StatusGoogleAds = {
  /** Se esta instalação tem as quatro variáveis do Google. Com `false` a tela não desenha NADA de
   *  Google Ads: nem botão, nem filtro, nem aviso. */
  disponivel: boolean;
  status: "desconectado" | "conectado" | "erro";
  contaId: string | null;
  erroMensagem: string | null;
};

const AUSENTE: StatusGoogleAds = {
  disponivel: false,
  status: "desconectado",
  contaId: null,
  erroMensagem: null,
};

/**
 * O estado da conexão com o Google Ads: se o canal existe nesta instalação, se está ligado, e o
 * botão de desligar.
 *
 * É parecido com o `useIntegracaoMeta`, mas não é ele: aqui existe um passo a mais, o `disponivel`,
 * que a Meta não tem. A Meta é um app só, ligado desde sempre. O Google exige um token de
 * desenvolvedor aprovado por eles, e enquanto essa aprovação não sai o canal não pode aparecer pra
 * ninguém — nem desabilitado, nem como "em breve". Foi exatamente esse tipo de rótulo sem nada
 * atrás que acabou de sair da tela de Tráfego.
 *
 * Começa como indisponível e só liga depois da resposta do servidor. Assim o botão não pisca na
 * tela de quem não tem a integração.
 *
 * ESTÁ SEPARADO DO `useGoogleAds` DE PROPÓSITO. Tráfego precisa do status E das campanhas;
 * Configurações precisa só do status. Sem essa separação, abrir Configurações dispararia uma
 * consulta à API do Google pra montar uma lista de campanhas que aquela tela não mostra.
 */
export function useStatusGoogleAds() {
  const [statusGoogle, setStatusGoogle] = useState<StatusGoogleAds>(AUSENTE);
  const [desconectando, setDesconectando] = useState(false);

  function carregarStatus() {
    return fetch("/api/integracoes/google-ads/status")
      .then((r) => (r.ok ? r.json() : AUSENTE))
      .then((dados: StatusGoogleAds) => {
        setStatusGoogle(dados);
        return dados;
      })
      .catch(() => {
        // Falha de rede não pode virar botão de conectar na tela de quem nem tem o canal liberado.
        setStatusGoogle(AUSENTE);
        return AUSENTE;
      });
  }

  useEffect(() => {
    void carregarStatus();
    // Roda uma vez: o status não muda sem um redirect do OAuth, que recarrega a página inteira.
  }, []);

  async function desconectar() {
    setDesconectando(true);
    try {
      await fetch("/api/integracoes/meta/desconectar?provedor=google_ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limparDados: false }),
      });
      await carregarStatus();
    } finally {
      setDesconectando(false);
    }
  }

  return { statusGoogle, carregarStatus, desconectando, desconectar };
}

/** O status mais as campanhas. É o que a tela de Tráfego consome. */
export function useGoogleAds() {
  const { statusGoogle, desconectando, desconectar: desconectarConta } = useStatusGoogleAds();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);

  const ligado = statusGoogle.disponivel && statusGoogle.status === "conectado";
  useEffect(() => {
    // Nada a limpar quando está desligado: a lista nasce vazia, e o único caminho que a enche é
    // este efeito. Quem desconecta pela tela esvazia a lista no `desconectar` abaixo.
    if (!ligado) return;
    fetch("/api/integracoes/google-ads/campanhas")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => setCampanhas(Array.isArray(lista) ? lista : []))
      .catch((erro) => console.error("Falha ao carregar campanhas do Google Ads:", erro));
  }, [ligado]);

  async function desconectar() {
    await desconectarConta();
    setCampanhas([]);
  }

  return { statusGoogle, campanhasGoogle: campanhas, desconectando, desconectar };
}
