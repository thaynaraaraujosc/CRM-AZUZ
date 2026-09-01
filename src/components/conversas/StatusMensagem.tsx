"use client";

import type { ReactNode } from "react";

import type { StatusMensagem } from "@/lib/data";
import { IconCheck, IconCheckDuplo, IconErro, IconMic, IconRelogio } from "@/components/icons";

/**
 * Os tiquinhos de status de uma mensagem enviada.
 *
 * Vive fora da tela de Conversas porque o funil também precisa deles: a mesma mensagem tem que
 * contar a mesma história nos dois lugares. Antes, quem respondia pelo funil não via status nenhum
 * e não tinha como saber se a mensagem havia saído.
 *
 * Cada estado corresponde a um fato conhecido — "enviado" é a Meta confirmando o envio, "entregue"
 * e "lido" vêm do webhook de status. Não existe estado adivinhado aqui.
 */
export function StatusMensagemIcone({
  status,
  onTentarNovamente,
}: {
  status?: StatusMensagem;
  onTentarNovamente?: () => void;
}) {
  if (!status) return null;

  if (status === "erro") {
    return (
      <span className="msg-status msg-status-erro">
        <span
          className="msg-status-icone"
          title="Não enviada — toque para tentar de novo"
          aria-label="Mensagem não enviada"
        >
          <IconErro width={13} height={13} />
        </span>
        {onTentarNovamente ? (
          <button type="button" className="msg-status-retry" onClick={onTentarNovamente}>
            Tentar novamente
          </button>
        ) : null}
      </span>
    );
  }

  const mapa: Record<Exclude<StatusMensagem, "erro">, { icone: ReactNode; titulo: string; classe: string }> = {
    pendente: { icone: <IconRelogio width={12} height={12} />, titulo: "Aguardando envio", classe: "" },
    enviado: { icone: <IconCheck width={13} height={13} />, titulo: "Enviada", classe: "" },
    entregue: { icone: <IconCheckDuplo width={14} height={14} />, titulo: "Entregue no aparelho do lead", classe: "" },
    lido: { icone: <IconCheckDuplo width={14} height={14} />, titulo: "Lida pelo lead", classe: "lido" },
    reproduzido: { icone: <IconMic width={12} height={12} />, titulo: "Áudio reproduzido pelo lead", classe: "reproduzido" },
  };

  const info = mapa[status];
  return (
    <span className={`msg-status-icone ${info.classe}`} title={info.titulo} aria-label={info.titulo} role="img">
      {info.icone}
    </span>
  );
}
