import { useEffect, useRef, useState } from "react";

export type HistoricoSync = {
  status: "em_andamento" | "pausado" | "concluido" | "erro";
  totalChats: number | null;
  chatsProcessados: number;
  filaRestante: { remoteJid: string; arquivada: boolean }[] | null;
  erro?: string;
};

export type StatusIntegracaoNaoOficial = {
  status: "desconectado" | "aguardando_qr" | "conectado" | "erro";
  metadados: { qrDataUrl?: string | null; numero?: string | null; historico?: HistoricoSync } | null;
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

  // Motor da sincronização de histórico — chama o batch (5 conversas por vez) repetidamente
  // enquanto `historico.status === "em_andamento"`, com uma pausa pequena entre chamadas (não bate
  // a Evolution/banco sem parar). Some da fila quando ninguém tem essa tela aberta (fecha a aba,
  // sincronização pausa) — retoma sozinha da próxima vez que alguém abrir, porque o progresso já
  // está salvo no servidor (`Integracao.metadados.historico`), não perdido.
  const sincronizandoRef = useRef(false);
  const historicoStatus = estado?.metadados?.historico?.status;
  const temHistorico = Boolean(estado?.metadados?.historico);
  const conectada = estado?.status === "conectado";
  useEffect(() => {
    // Dispara também quando NUNCA teve histórico nenhum (não só quando já está "em_andamento") —
    // cobre quem já estava conectado ANTES dessa sincronização existir: o gatilho normal
    // (`connection.update`/`open` no webhook) só dispara numa conexão nova, não pra quem já tava
    // conectado, então sem isso essa conta nunca ganhava a sincronização sozinha.
    const deveComecar = historicoStatus === "em_andamento" || (conectada && !temHistorico);
    if (!deveComecar || sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    let cancelado = false;

    (async function passo() {
      while (!cancelado) {
        const resposta = await fetch("/api/integracoes/whatsapp-nao-oficial/sincronizar-historico", {
          method: "POST",
        }).catch((erro) => {
          console.error("Falha ao sincronizar histórico:", erro);
          return null;
        });
        const dados = (await resposta?.json().catch(() => null)) as
          | { historico?: HistoricoSync }
          | null;
        if (dados?.historico) {
          setEstado((prev) =>
            prev ? { ...prev, metadados: { ...prev.metadados, historico: dados.historico } } : prev,
          );
        }
        if (!dados?.historico || dados.historico.status !== "em_andamento") break;
        // 4s entre conversas (não 800ms) — uma sessão do WhatsApp recém-conectada é mais sensível a
        // comportamento automatizado; ir mais devagar reduz o risco de a própria WhatsApp derrubar
        // a sessão de novo por parecer bot batendo na API sem parar.
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    })().finally(() => {
      sincronizandoRef.current = false;
    });

    return () => {
      cancelado = true;
    };
  }, [historicoStatus, temHistorico, conectada]);

  /** Pausa a sincronização de histórico sem perder o progresso — pode retomar depois clicando de
   * novo. Existe pra usuária ter controle se desconfiar que a sincronização está sobrecarregando a
   * conexão do WhatsApp. */
  async function pausarSincronizacaoHistorico() {
    const resposta = await fetch("/api/integracoes/whatsapp-nao-oficial/sincronizar-historico", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pausado" }),
    }).catch(() => null);
    const dados = (await resposta?.json().catch(() => null)) as { historico?: HistoricoSync } | null;
    if (dados?.historico) {
      setEstado((prev) => (prev ? { ...prev, metadados: { ...prev.metadados, historico: dados.historico } } : prev));
    }
  }

  async function retomarSincronizacaoHistorico() {
    const resposta = await fetch("/api/integracoes/whatsapp-nao-oficial/sincronizar-historico", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "em_andamento" }),
    }).catch(() => null);
    const dados = (await resposta?.json().catch(() => null)) as { historico?: HistoricoSync } | null;
    if (dados?.historico) {
      setEstado((prev) => (prev ? { ...prev, metadados: { ...prev.metadados, historico: dados.historico } } : prev));
    }
  }

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

  return {
    estado,
    desconectando,
    desconectar,
    conectando,
    conectar,
    erro,
    pausarSincronizacaoHistorico,
    retomarSincronizacaoHistorico,
  };
}
