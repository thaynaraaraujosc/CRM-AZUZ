import { useEffect, useState } from "react";

export type StatusIntegracaoNaoOficial = {
  status: "desconectado" | "aguardando_qr" | "conectado" | "erro";
  metadados: { qrDataUrl?: string | null; numero?: string | null } | null;
  erroMensagem: string | null;
};

/**
 * Status da conexão WhatsApp "não oficial" (Evolution API, servidor próprio fora da Vercel, ver
 * src/lib/integracoes/evolution.ts) — polling contínuo porque o QR expira e a conexão pode cair a
 * qualquer momento; usado tanto pela tela de Configurações quanto pela lista de Conversas (que
 * precisa saber se esse canal está conectado pra decidir se mostra/filtra o WhatsApp).
 */
export function useIntegracaoNaoOficial(intervaloMs = 4000) {
  const [estado, setEstado] = useState<StatusIntegracaoNaoOficial | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  /** Cria a instância na Evolution (se ainda não existir) e busca o primeiro QR Code — chamado
   * quando a pessoa clica em "Conectar"; depois disso, o polling e os eventos de webhook cuidam do
   * resto (QR renovado, confirmação de conectado). */
  async function conectar() {
    setConectando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp-nao-oficial/conectar", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao conectar");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conectar");
    } finally {
      setConectando(false);
    }
  }

  async function desconectar() {
    setDesconectando(true);
    try {
      await fetch("/api/integracoes/whatsapp-nao-oficial/desconectar", { method: "POST" });
      carregar();
    } finally {
      setDesconectando(false);
    }
  }

  return { estado, desconectando, desconectar, conectando, conectar, erro };
}
