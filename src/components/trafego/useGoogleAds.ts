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
 * O estado do Google Ads na tela de Tráfego.
 *
 * É parecido com o `useIntegracaoMeta`, mas não é ele: aqui existe um passo a mais, o `disponivel`,
 * que a Meta não tem. A Meta é um app só, ligado desde sempre. O Google exige um token de
 * desenvolvedor aprovado por eles, e enquanto essa aprovação não sai o canal não pode aparecer pra
 * ninguém — nem desabilitado, nem como "em breve". Foi exatamente esse tipo de rótulo sem nada
 * atrás que acabou de sair desta tela.
 *
 * Começa como indisponível e só liga depois da resposta do servidor. Assim o botão não pisca na
 * tela de quem não tem a integração.
 */
export function useGoogleAds() {
  const [statusGoogle, setStatusGoogle] = useState<StatusGoogleAds>(AUSENTE);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
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
    void carregarStatus().then((dados) => {
      if (!dados.disponivel || dados.status !== "conectado") {
        setCampanhas([]);
        return;
      }
      fetch("/api/integracoes/google-ads/campanhas")
        .then((r) => (r.ok ? r.json() : []))
        .then((lista) => setCampanhas(Array.isArray(lista) ? lista : []))
        .catch((erro) => console.error("Falha ao carregar campanhas do Google Ads:", erro));
    });
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
      setCampanhas([]);
      await carregarStatus();
    } finally {
      setDesconectando(false);
    }
  }

  return { statusGoogle, campanhasGoogle: campanhas, desconectando, desconectar };
}
