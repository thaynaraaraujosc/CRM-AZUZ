import { useEffect, useRef, useState } from "react";

export type StatusIntegracaoBaileys = {
  status: "aguardando_qr" | "conectado" | "desconectado";
  qrDataUrl: string | null;
  numero: string | null;
};

/**
 * Conexão WhatsApp "não oficial" via QR Code (worker Baileys separado) — diferente do
 * `useIntegracaoMeta` (fluxo OAuth com redirect), aqui o fluxo é: chama `conectar`, e enquanto o
 * status devolvido for `"aguardando_qr"` faz polling em `GET status` a cada 2s pra pegar o QR (ele
 * expira rápido, por isso o polling) até virar `"conectado"` ou a pessoa desistir.
 */
export function useIntegracaoBaileys() {
  const [estado, setEstado] = useState<StatusIntegracaoBaileys | null>(null);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pararPolling() {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }

  function consultarStatus() {
    fetch("/api/integracoes/whatsapp-baileys/status")
      .then((r) => r.json())
      .then((dados: StatusIntegracaoBaileys | { erro: string }) => {
        if ("erro" in dados) {
          setErro(dados.erro);
          pararPolling();
          setConectando(false);
          return;
        }
        setEstado(dados);
        if (dados.status !== "aguardando_qr") {
          pararPolling();
          setConectando(false);
        }
      })
      .catch(() => {
        setErro("Não foi possível falar com o serviço de conexão.");
        pararPolling();
        setConectando(false);
      });
  }

  useEffect(() => {
    consultarStatus();
    // Só roda uma vez no mount, pra saber o estado atual sem precisar clicar em "Conectar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => pararPolling, []);

  async function conectar() {
    setErro(null);
    setConectando(true);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp-baileys/conectar", { method: "POST" });
      const dados = (await resposta.json()) as { ok?: boolean; erro?: string };
      if (!resposta.ok || dados.erro) {
        setErro(dados.erro ?? "Falha ao iniciar conexão.");
        setConectando(false);
        return;
      }
      consultarStatus();
      pararPolling();
      intervaloRef.current = setInterval(consultarStatus, 2000);
    } catch {
      setErro("Não foi possível falar com o serviço de conexão.");
      setConectando(false);
    }
  }

  async function desconectar() {
    pararPolling();
    await fetch("/api/integracoes/whatsapp-baileys/desconectar", { method: "POST" });
    consultarStatus();
  }

  return { estado, conectando, erro, conectar, desconectar };
}
