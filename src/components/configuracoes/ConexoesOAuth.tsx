"use client";

import { useIntegracaoMeta } from "./useIntegracaoMeta";

/**
 * Conexão do Instagram e do Meta Ads como painel — mesmo motivo de `ConexaoQrCode` e
 * `ConexaoWhatsAppOficial`: o fluxo roda embaixo do botão que a pessoa clicou, em vez de mandar
 * ela pra outra tela.
 *
 * Os dois são um redirect de OAuth (a autorização acontece no site da Meta e volta pro CRM), então
 * o painel não tem formulário: mostra o que vai acontecer, o estado atual e o link que inicia o
 * fluxo. O ganho é a pessoa ver o contexto e decidir aqui, sem passar por uma tela intermediária
 * que só repetia a escolha que ela já tinha feito.
 */
function PainelOAuth({
  provedor,
  href,
  descricao,
  rotuloConectado,
  rotuloDesconectar,
}: {
  provedor: string;
  href: string;
  descricao: string;
  rotuloConectado: string;
  rotuloDesconectar: string;
}) {
  const { integracao, desconectando, desconectar } = useIntegracaoMeta(provedor);
  const conectado = integracao?.status === "conectado";

  if (conectado) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="int-sub" style={{ margin: 0 }}>{rotuloConectado}</p>
        <button type="button" className="btn danger" onClick={() => void desconectar()} disabled={desconectando}>
          {desconectando ? "Desconectando…" : rotuloDesconectar}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <p className="hint" style={{ margin: 0 }}>{descricao}</p>
      <a href={href} className="btn primary" style={{ flex: "0 0 auto" }}>
        Autorizar
      </a>
    </div>
  );
}

export function ConexaoInstagram() {
  const { integracao } = useIntegracaoMeta("meta_instagram");
  const usuario = integracao?.metadados?.instagramUsername as string | undefined;

  return (
    <PainelOAuth
      provedor="meta_instagram"
      href="/api/integracoes/instagram/conectar"
      descricao="Autoriza o CRM a acessar sua conta profissional do Instagram e receber as mensagens do Direct — sem copiar token nenhum."
      rotuloConectado={usuario ? `Conectado — @${usuario}` : "Conta conectada"}
      rotuloDesconectar="Desconectar Instagram"
    />
  );
}

export function ConexaoMetaAds() {
  const { integracao } = useIntegracaoMeta("meta_ads");
  const conta = integracao?.metadados?.adAccountNome as string | undefined;

  return (
    <PainelOAuth
      provedor="meta_ads"
      href="/api/integracoes/meta/conectar?provedor=meta_ads"
      descricao="Autoriza o CRM a ler suas campanhas — é o que faz a origem dos leads aparecer no painel de Tráfego."
      rotuloConectado={conta ? `Conectado — ${conta}` : "Conta de anúncios conectada"}
      rotuloDesconectar="Desconectar Meta Ads"
    />
  );
}
