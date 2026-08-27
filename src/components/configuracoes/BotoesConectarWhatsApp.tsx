"use client";

import { useState } from "react";

import { ConexaoQrCode } from "./ConexaoQrCode";
import { ConexaoWhatsAppOficial } from "./ConexaoWhatsAppOficial";

/**
 * Atalhos de conexão no topo da tela de Conversas.
 *
 * Conectar um número é a primeira coisa que alguém faz numa tela de atendimento vazia, mas o
 * caminho até aqui passava por Configurações → WhatsApp — longe de onde a falta do número é
 * percebida. Cada botão abre o fluxo do SEU canal direto, sem tela intermediária pedindo pra
 * escolher de novo entre os dois.
 */
type Canal = "oficial" | "qrcode" | null;

export function BotoesConectarWhatsApp() {
  const [aberto, setAberto] = useState<Canal>(null);

  return (
    <>
      <button type="button" className="fsel" onClick={() => setAberto("qrcode")}>
        Conectar WhatsApp QR Code
      </button>
      <button type="button" className="fsel" onClick={() => setAberto("oficial")}>
        Conectar WhatsApp API oficial
      </button>

      {aberto ? (
        <div className="modal-overlay" onClick={() => setAberto(null)}>
          {/* `stopPropagation` no conteúdo — sem isso, clicar dentro do painel (num campo, num
              botão) borbulha pro overlay e fecha o modal no meio do preenchimento. */}
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <p className="int-title" style={{ margin: 0 }}>
                {aberto === "qrcode" ? "Conectar por QR Code" : "Conectar pela API oficial (Meta)"}
              </p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Fechar"
                onClick={() => setAberto(null)}
              >
                ×
              </button>
            </div>

            <p className="hint" style={{ margin: "6px 0 14px" }}>
              {aberto === "qrcode"
                ? "Escaneia como o WhatsApp Web — não passa pela verificação de negócio da Meta, e o número corre risco de ser banido por violar os termos de uso do WhatsApp."
                : "Canal oficial da Meta. Mantém o número em conformidade e não corre risco de banimento."}
            </p>

            {aberto === "qrcode" ? <ConexaoQrCode /> : <ConexaoWhatsAppOficial />}
          </div>
        </div>
      ) : null}
    </>
  );
}
