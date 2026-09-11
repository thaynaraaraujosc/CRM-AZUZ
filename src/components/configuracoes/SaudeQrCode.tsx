"use client";

import { useEffect, useState } from "react";

type Saude = {
  webhookCerto: boolean;
  reparado: boolean;
  minutosDesdeOUltimoEvento: number | null;
  diagnostico: string;
};

/**
 * "Chega mensagem no meu celular e não chega no CRM."
 *
 * O WhatsApp por QR Code depende de um aviso que fica registrado no servidor do WhatsApp, não
 * neste CRM. Quando esse registro se perde, o celular continua recebendo, a conexão continua
 * marcada como conectada, e nenhuma mensagem chega aqui. Isso era invisível.
 *
 * Ao abrir a tela o CRM confere e CONSERTA sozinho. Esta linha só aparece quando há algo pra
 * contar: no estado saudável ela não ocupa espaço nenhum, porque ninguém precisa ler todo dia que
 * está tudo bem.
 */
export function SaudeQrCode() {
  const [saude, setSaude] = useState<Saude | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/whatsapp-nao-oficial/saude")
      .then((r) => r.json())
      .then((dados) => setSaude("erro" in dados ? null : dados))
      .catch(() => setSaude(null));
  }, []);

  if (!saude) return null;
  const saudavel = saude.webhookCerto && !saude.reparado && (saude.minutosDesdeOUltimoEvento ?? 0) <= 60;
  if (saudavel) return null;

  return <p className={saude.reparado ? "hint" : "int-aviso-conflito"}>{saude.diagnostico}</p>;
}
