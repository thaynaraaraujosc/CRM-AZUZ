import { useEffect, useRef, useState } from "react";

export type HistoricoSync = {
  status: "em_andamento" | "pausado" | "concluido" | "erro";
  totalChats: number | null;
  chatsProcessados: number;
  filaRestante: { remoteJid: string }[] | null;
  erro?: string;
};

export type StatusIntegracaoNaoOficial = {
  status: "desconectado" | "aguardando_qr" | "conectado" | "erro";
  metadados: { qrDataUrl?: string | null; numero?: string | null; historico?: HistoricoSync } | null;
  erroMensagem: string | null;
};

/**
 * Status da conexão WhatsApp "não oficial" (Evolution API, servidor próprio fora da Vercel, ver
 * src/lib/integracoes/evolution.ts): polling contínuo porque o QR expira e a conexão pode cair a
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

  /**
   * Ritmo do polling, decidido a cada batida.
   *
   * Os 4 segundos existem por causa do QR Code: ele expira rápido, e quem está com o celular na mão
   * apontando pra tela precisa ver "conectado" quase na hora. Mas esse é um momento de dois minutos
   *. O resto do tempo a conexão está estabelecida e não muda por dias.
   *
   * Cobrando os 4 segundos o tempo todo, uma aba de Conversas aberta o dia inteiro batia no banco
   * 21.600 vezes por dia só pra ouvir "continua conectado". Cada uma dessas idas atravessa a
   * internet até o Railway e volta, e o Railway cobra por byte que sai do banco.
   *
   * Então: rápido quando está acontecendo alguma coisa (esperando o QR, sincronizando histórico),
   * devagar quando está só conectado. A experiência de quem lê o QR não muda em nada.
   */
  const RITMO_ATIVO = 4000;
  const RITMO_PARADO = 30000;
  // Espelho do estado pro agendador ler sem ser recriado a cada mudança. Escrito num efeito, e não
  // no corpo do componente: mexer em ref durante a renderização quebra a garantia do React de que
  // renderizar não tem efeito colateral (e o lint pega).
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  useEffect(() => {
    carregar();

    // `setTimeout` que se reagenda, e não `setInterval`: o intervalo precisa ser recalculado a cada
    // batida (o estado muda no meio), e `setInterval` congela o valor de quando foi criado.
    let temporizador: ReturnType<typeof setTimeout>;
    function agendar() {
      const atual = estadoRef.current;
      const ativo =
        atual === null ||
        atual.status === "aguardando_qr" ||
        atual.metadados?.historico?.status === "em_andamento";
      temporizador = setTimeout(() => {
        // Só busca com a aba à frente. Com o CRM aberto em segundo plano (o normal, é uma aba que
        // fica o dia inteiro) isso era requisição sem ninguém olhando.
        if (document.visibilityState === "visible") carregar();
        agendar();
      }, ativo ? Math.min(intervaloMs, RITMO_ATIVO) : RITMO_PARADO);
    }
    agendar();
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervaloMs é constante na prática, não precisa reiniciar o polling se mudar
  }, []);

  // Motor da sincronização de histórico. Chama o batch (5 conversas por vez) repetidamente
  // enquanto `historico.status === "em_andamento"`, com uma pausa pequena entre chamadas (não bate
  // a Evolution/banco sem parar). Some da fila quando ninguém tem essa tela aberta (fecha a aba,
  // sincronização pausa): retoma sozinha da próxima vez que alguém abrir, porque o progresso já
  // está salvo no servidor (`Integracao.metadados.historico`), não perdido.
  const sincronizandoRef = useRef(false);
  const historicoStatus = estado?.metadados?.historico?.status;
  const temHistorico = Boolean(estado?.metadados?.historico);
  const conectada = estado?.status === "conectado";
  useEffect(() => {
    // Dispara também quando NUNCA teve histórico nenhum (não só quando já está "em_andamento").
    // Cobre quem já estava conectado ANTES dessa sincronização existir: o gatilho normal
    // (`connection.update`/`open` no webhook) só dispara numa conexão nova, não pra quem já tava
    // conectado, então sem isso essa conta nunca ganhava a sincronização sozinha.
    // `conectada` é condição pra TUDO: sem sessão do WhatsApp de pé não há o que sincronizar, e
    // `historico.status` pode continuar "em_andamento" para sempre depois de uma queda (fica
    // gravado assim no servidor). Sem essa checagem, o motor abaixo virava um laço apertado
    // batendo no endpoint várias vezes por segundo, indefinidamente, contra uma conexão morta.
    const deveComecar = conectada && (historicoStatus === "em_andamento" || !temHistorico);
    if (!deveComecar || sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    let cancelado = false;

    // Uma resposta sem `historico` é falha (rede, sessão caída, erro no servidor). Desistir na
    // primeira seria frágil demais numa sincronização longa, mas insistir sem limite foi o que
    // gerou o laço apertado: então: espera antes de tentar de novo e para depois de 3 seguidas.
    const MAX_FALHAS_SEGUIDAS = 3;
    let falhasSeguidas = 0;

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
          falhasSeguidas = 0;
          setEstado((prev) =>
            prev ? { ...prev, metadados: { ...prev.metadados, historico: dados.historico } } : prev,
          );
        } else {
          falhasSeguidas += 1;
          if (falhasSeguidas >= MAX_FALHAS_SEGUIDAS) {
            console.error("Sincronização de histórico parada após falhas seguidas.");
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 4000));
          continue;
        }
        if (dados.historico.status !== "em_andamento") break;
        // 4s entre conversas (não 800ms). Uma sessão do WhatsApp recém-conectada é mais sensível a
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

  /** Pausa a sincronização de histórico sem perder o progresso. Pode retomar depois clicando de
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

  /** Cria a instância na Evolution (se ainda não existir) e busca o primeiro QR Code. Chamado
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

  async function desconectar(limparDados = false) {
    setDesconectando(true);
    try {
      await fetch("/api/integracoes/whatsapp-nao-oficial/desconectar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limparDados }),
      });
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
