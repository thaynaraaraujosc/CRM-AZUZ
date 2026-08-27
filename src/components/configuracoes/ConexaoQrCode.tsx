"use client";

import { useState } from "react";

import { useIntegracaoNaoOficial } from "./useIntegracaoNaoOficial";

/**
 * Fluxo de conexão por QR Code, isolado do resto da tela de Configurações.
 *
 * Existia só dentro de `WhatsAppSecao`, o que obrigava qualquer outro lugar a mandar a pessoa pra
 * lá — o motivo de "Conectar" em Integrações abrir outra página e pedir de novo o mesmo tipo de
 * escolha. Como componente, o mesmo fluxo roda embaixo do botão que a pessoa acabou de clicar,
 * onde quer que ele esteja.
 */
export function ConexaoQrCode({ aoConectar }: { aoConectar?: () => void }) {
  const naoOficial = useIntegracaoNaoOficial();
  const [aberto, setAberto] = useState(false);

  const conectada = naoOficial.estado?.status === "conectado";

  if (conectada) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="int-sub" style={{ margin: 0 }}>
          Conectado{naoOficial.estado?.metadados?.numero ? ` — ${naoOficial.estado.metadados.numero}` : ""}
        </p>
        <button
          type="button"
          className="btn danger"
          onClick={() => void naoOficial.desconectar()}
          disabled={naoOficial.desconectando}
        >
          {naoOficial.desconectando ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          setAberto(true);
          naoOficial.conectar();
          aoConectar?.();
        }}
        disabled={naoOficial.conectando}
      >
        {naoOficial.conectando ? "Gerando QR Code…" : "Gerar QR Code"}
      </button>
    );
  }

  if (naoOficial.erro || naoOficial.estado?.status === "erro") {
    return (
      <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
        ⚠ {naoOficial.erro ?? naoOficial.estado?.erroMensagem}
      </p>
    );
  }

  if (naoOficial.estado?.status === "aguardando_qr" && naoOficial.estado.metadados?.qrDataUrl) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {/* Fundo branco explícito — o PNG que a Evolution devolve tem fundo TRANSPARENTE (não
            branco de verdade), então sem isso o card do CRM (levemente azulado) aparece por trás,
            dando o efeito de QR "com uma tela azul em cima". */}
        <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL gerado on-the-fly pela Evolution API, não é asset estático */}
          <img src={naoOficial.estado.metadados.qrDataUrl} alt="QR Code de conexão do WhatsApp" width={200} height={200} />
        </div>
        <p className="hint" style={{ margin: 0 }}>
          Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.
        </p>
      </div>
    );
  }

  return (
    <p className="hint" style={{ margin: 0 }}>
      {naoOficial.conectando ? "Gerando QR Code…" : "Aguardando o QR Code…"}
    </p>
  );
}
