"use client";

import { useSession } from "next-auth/react";

import { ConexaoManualWhatsApp } from "./ConexaoManualWhatsApp";
import { EmbeddedSignupWhatsApp } from "./EmbeddedSignupWhatsApp";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

/**
 * Fluxo de conexão da API oficial (Meta), isolado do resto da tela de Configurações. Mesmo motivo
 * de `ConexaoQrCode`: assim ele roda embaixo do botão que a pessoa clicou, em qualquer tela, em vez
 * de mandar ela pra outra página escolher de novo entre os dois canais.
 *
 * São dois caminhos porque a Meta tem dois: o Embedded Signup cria a conta de dentro do CRM mas
 * exige app aprovado como Provedor de Tecnologia; conectar por token serve pra quem já tem a conta
 * criada e aprovada, e não depende de aprovação nenhuma.
 *
 * O SEGUNDO CAMINHO SÓ APARECE PRO SUPERADMIN, e os dois motivos puxam pra lados opostos:
 *
 * Pro cliente, ele não devia existir. Conectar por token exige abrir o painel de desenvolvedor da
 * Meta e copiar três identificadores de lá — trabalho de quem mantém o sistema, não de quem só
 * quer ligar o WhatsApp. Um botão que a pessoa não tem como usar sozinha só atrapalha a decisão.
 *
 * Mas APAGAR não serve: se o Cadastro Incorporado falhar pra alguém, era esta a única saída, e
 * sem ela o atendimento fica parado até alguém mexer em código. Guardado atrás do superadmin, ele
 * some da tela do cliente e continua à mão pra dar suporte.
 */
export function ConexaoWhatsAppOficial() {
  const { data: sessao } = useSession();
  const { integracao, desconectando, desconectar, recarregar } = useIntegracaoMeta("meta_whatsapp");
  const conectada = integracao?.status === "conectado";

  if (conectada) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="int-sub" style={{ margin: 0 }}>
          Conectado
          {(integracao?.metadados?.numeroExibicao as string | undefined)
            ? `: ${integracao?.metadados?.numeroExibicao as string}`
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
      {sessao?.user?.superAdmin ? <ConexaoManualWhatsApp aoConectar={recarregar} /> : null}
    </div>
  );
}
