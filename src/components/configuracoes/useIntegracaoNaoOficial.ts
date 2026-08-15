import { useEffect, useState } from "react";

export type StatusIntegracaoNaoOficial = {
  status: "desconectado" | "aguardando_qr" | "conectado" | "erro";
  metadados: { qrDataUrl?: string | null; numero?: string | null } | null;
  erroMensagem: string | null;
};

/**
 * Status da conexão WhatsApp "não oficial" (whatsapp-service separado, ver
 * whatsapp-service/README.md) — polling contínuo porque o QR expira e a conexão pode cair a
 * qualquer momento; usado tanto pela tela de Configurações quanto pela lista de Conversas (que
 * precisa saber se esse canal está conectado pra decidir se mostra/filtra o WhatsApp).
 */
export function useIntegracaoNaoOficial(intervaloMs = 4000) {
  const [estado, setEstado] = useState<StatusIntegracaoNaoOficial | null>(null);
  const [desconectando, setDesconectando] = useState(false);

  function carregar() {
    fetch("/api/integracoes/whatsapp-nao-oficial")
      .then((r) => r.json())
      .then(setEstado)
      .catch((erro) => console.error("Falha ao carregar status do WhatsApp não oficial:", erro));
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, intervaloMs);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervaloMs é constante na prática, não precisa reiniciar o polling se mudar
  }, []);

  async function desconectar() {
    setDesconectando(true);
    try {
      await fetch("/api/integracoes/whatsapp-nao-oficial/desconectar", { method: "POST" });
      carregar();
    } finally {
      setDesconectando(false);
    }
  }

  return { estado, desconectando, desconectar };
}
