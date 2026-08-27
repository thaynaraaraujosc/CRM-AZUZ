"use client";

import { ConexaoManualWhatsApp } from "./ConexaoManualWhatsApp";
import { EmbeddedSignupWhatsApp } from "./EmbeddedSignupWhatsApp";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

/**
 * Fluxo de conexão da API oficial (Meta), isolado do resto da tela de Configurações — mesmo motivo
 * de `ConexaoQrCode`: assim ele roda embaixo do botão que a pessoa clicou, em qualquer tela, em vez
 * de mandar ela pra outra página escolher de novo entre os dois canais.
 *
 * São dois caminhos porque a Meta tem dois: o Embedded Signup cria a conta de dentro do CRM mas
 * exige app aprovado como Provedor de Tecnologia; conectar por token serve pra quem já tem a conta
 * criada e aprovada, e não depende de aprovação nenhuma.
 */
export function ConexaoWhatsAppOficial() {
  const { integracao, desconectando, desconectar, recarregar } = useIntegracaoMeta("meta_whatsapp");
  const conectada = integracao?.status === "conectado";

  if (conectada) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="int-sub" style={{ margin: 0 }}>
          Conectado
          {(integracao?.metadados?.numeroExibicao as string | undefined)
            ? ` — ${integracao?.metadados?.numeroExibicao as string}`
            : ""}
        </p>
        <button
          type="button"
          className="btn danger"
          onClick={() => void desconectar()}
          disabled={desconectando}
        >
          {desconectando ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <EmbeddedSignupWhatsApp aoConectar={recarregar} />
      <ConexaoManualWhatsApp aoConectar={recarregar} />
    </div>
  );
}
