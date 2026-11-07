"use client";

import { IconAlerta } from "@/components/icons";
import type { HistoricoSync } from "@/lib/integracoes/historico-tipos";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O estado da importação das conversas do celular, e os botões pra mexer nela.
 *
 * MORA NUM ARQUIVO PRÓPRIO PORQUE PRECISA APARECER EM DOIS LUGARES. Ele nasceu dentro de
 * `WhatsAppSecao`, que é a categoria "WhatsApp" das Configurações — e essa categoria NÃO ESTÁ NO
 * MENU: só se chega nela por URL (`?categoria=whatsapp`). Na prática, "Buscar conversas que faltam"
 * e o progresso da importação ficavam atrás de uma porta sem maçaneta: quem não recebia as
 * conversas do celular não tinha como pedir pra buscar de novo, nem como ver em que pé estava.
 *
 * Agora ele também fica no painel do WhatsApp dentro de Integrações, que é onde se chega clicando.
 * É a mesma correção que já tinha sido feita pro "Limpar dados do WhatsApp anterior", pelo mesmo
 * motivo, e isto aqui é o resto dela.
 */
const ROTA = "/api/integracoes/whatsapp-nao-oficial/sincronizar-historico";

export function ImportarConversas({
  historico,
  conectada,
  aoMudar,
  slot = 1,
}: {
  historico: HistoricoSync | null | undefined;
  /** O número está conectado agora? Sem conexão não há celular pra perguntar. */
  conectada?: boolean;
  /** O pai guarda o estado da integração; esta é a forma de devolver o progresso novo pra ele. */
  aoMudar: (historico: HistoricoSync) => void;
  /** Qual número está sendo importado: cada celular conectado tem a fila dele. */
  slot?: number;
}) {
  const { t: traduzir } = useIdioma();
  // `?slot=` em toda chamada: sem ele, mexer na importação do segundo número mexeria na do primeiro.
  const comSlot = (caminho: string) => `${caminho}${caminho.includes("?") ? "&" : "?"}slot=${slot}`;

  async function chamar(caminho: string, method: "POST" | "PUT" | "PATCH", corpo?: unknown) {
    const resposta = await fetch(comSlot(caminho), {
      method,
      ...(corpo ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : {}),
    }).catch(() => null);
    const dados = (await resposta?.json().catch(() => null)) as { historico?: HistoricoSync } | null;
    if (dados?.historico) aoMudar(dados.historico);
  }

  /*
   * SEM IMPORTAÇÃO NENHUMA REGISTRADA, O BOTÃO PRECISA EXISTIR ASSIM MESMO.
   *
   * Isto aqui era `return null`: número conectado, nenhuma conversa na tela, e nada em lugar
   * nenhum do produto pra pedir as conversas do celular — nem um aviso, nem um botão, nem um
   * erro. A importação começa sozinha (ao conectar e pelo relógio do servidor), mas quando ela
   * NÃO começou — conexão que abriu antes disso existir, metadados gravados por um caminho
   * antigo, uma falha silenciosa no meio — a tela ficava muda e a única saída era desconectar e
   * ler o QR Code de novo. Pedir pra cliente consertar o produto.
   *
   * Agora o caminho de volta está sempre visível enquanto o número estiver conectado.
   */
  if (!historico) {
    if (!conectada) return null;
    return (
      <div className="wa-historico-linha">
        <p className="hint" style={{ margin: 0 }}>
          {traduzir(
            "As conversas que já estão no celular ainda não foram trazidas. Isso costuma começar sozinho logo depois de conectar; se não começou, peça aqui.",
          )}
        </p>
        <button
          type="button"
          className="btn ghost"
          style={{ flex: "0 0 auto" }}
          onClick={() => chamar(`${ROTA}/reimportar`, "POST")}
        >
          {traduzir("Buscar conversas do celular")}
        </button>
      </div>
    );
  }

  return (
    <Painel
      historico={historico}
      onPausar={() => chamar(ROTA, "PATCH", { status: "pausado" })}
      onRetomar={() => chamar(ROTA, "PATCH", { status: "em_andamento" })}
      onTrazerMaisAntigas={() => chamar(ROTA, "PUT")}
      onReimportar={() => chamar(`${ROTA}/reimportar`, "POST")}
    />
  );
}

/** Progresso da sincronização de histórico sob demanda (ver `sincronizar-historico/route.ts`).
 * "Sincronizando conversas antigas: 34 de 180" enquanto roda, some sozinho quando termina. Tem um
 * botão de pausar/retomar: dá controle pra usuária caso desconfie que está pesando na conexão. */
function Painel({
  historico,
  onPausar,
  onRetomar,
  onTrazerMaisAntigas,
  onReimportar,
}: {
  historico: HistoricoSync;
  onPausar: () => void;
  onRetomar: () => void;
  onTrazerMaisAntigas: () => void;
  onReimportar: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const guardadas = historico.filaGuardada?.length ?? 0;

  /*
   * Terminou a primeira leva, e ainda há conversas antigas guardadas.
   *
   * Só as trinta mais recentes vêm sozinhas. Numa conta comercial o celular tem centenas, e trazer
   * todas de enfiada já derrubou o CRM uma vez. As antigas ficam a um clique de distância, e o
   * relógio importa em segundo plano do mesmo jeito.
   */
  /*
   * TERMINOU, E AINDA ASSIM PRECISA DE UM CAMINHO DE VOLTA.
   *
   * Antes esta tela não mostrava nada quando a fila guardada estava vazia, e não havia nenhum jeito
   * de rodar a importação de novo: conversa que nunca entrou na fila — grupo antigo, conversa que
   * passou a existir depois que a importação acabou — só apareceria se alguém escrevesse nela outra
   * vez. O único escape era desconectar e ler o QR Code de novo, que é pedir pra cliente consertar
   * o produto.
   *
   * Os dois botões fazem coisas diferentes, e é por isso que são dois: "Trazer as mais antigas"
   * devolve pra fila o que já estava guardado aqui; "Buscar conversas que faltam" pergunta pro
   * celular outra vez e remonta a fila do zero. Repetir não duplica nada (ver `reimportarHistorico`).
   */
  if (historico.status === "concluido") {
    return (
      <div className="wa-historico-linha">
        <p className="hint" style={{ margin: 0 }}>
          {/*
            * NÃO DIZER "JÁ FORAM TRAZIDAS" QUANDO NÃO VEIO NADA.
            *
            * `concluido` com zero conversa é o desfecho de "a sessão do WhatsApp não devolveu a
            * lista do celular a tempo". A tela afirmava sucesso nesse caso, e era a afirmação mais
            * enganosa possível: a pessoa não vê conversa nenhuma, o CRM diz que trouxe tudo, e a
            * conclusão razoável passa a ser que o produto está quebrado em algum lugar que ninguém
            * mostra. Zero conversa é um resultado a declarar, não a esconder.
            */}
          {/*
            * TRINTA CONVERSAS E ZERO MENSAGEM NÃO É SUCESSO.
            *
            * Já aconteceu, e por meses: a lista de conversas vinha, a fila andava, a tela dizia
            * "as conversas já foram trazidas" — e a caixa de entrada continuava vazia, porque o
            * leitor da resposta da Evolution não reconhecia o formato paginado. Um estado que a
            * tela não sabe nomear é um estado que só a cliente descobre.
            */}
          {!historico.totalChats
            ? "Não veio nenhuma conversa do celular nesta tentativa. Costuma ser a sessão do WhatsApp que ainda não terminou de montar a lista; buscar de novo resolve."
            : historico.mensagensVistas === 0
              ? `As ${historico.totalChats} conversas foram lidas, mas nenhuma mensagem veio junto. Busque de novo; se repetir, é a conexão com o WhatsApp que não está devolvendo o conteúdo.`
              : guardadas
                ? `As conversas recentes já estão aqui. Ainda há ${guardadas} conversa${guardadas > 1 ? "s" : ""} mais antiga${guardadas > 1 ? "s" : ""} no celular.`
                : traduzir("As conversas do celular já foram trazidas. Se faltar algum grupo ou conversa antiga, busque de novo.")}
        </p>
        {guardadas ? (
          <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={onTrazerMaisAntigas}>
            {traduzir("Trazer as mais antigas")}
          </button>
        ) : null}
        <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={onReimportar}>
          {traduzir("Buscar conversas que faltam")}
        </button>
      </div>
    );
  }
  /*
   * O ERRO TAMBÉM PRECISA DE UM BOTÃO.
   *
   * Era só a frase vermelha. Quem lia "não consegui terminar" não tinha o que fazer com a
   * informação: o único caminho de volta estava no ramo `concluido`, logo acima, que uma
   * importação em erro nunca alcança. Tentar de novo é exatamente o que se quer fazer ao ler isso.
   */
  if (historico.status === "erro") {
    return (
      <div className="wa-historico-linha">
        <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> Não consegui terminar de trazer o histórico de conversas ({historico.erro ?? "erro desconhecido"}).
          As mensagens novas continuam chegando normal.
        </p>
        <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={onReimportar}>
          {traduzir("Tentar de novo")}
        </button>
      </div>
    );
  }
  const total = historico.totalChats;
  const pausado = historico.status === "pausado";
  return (
    <div className="wa-historico-linha">
      <p className="hint" style={{ margin: 0 }}>
        {pausado ? traduzir("Importação do histórico pausada") : traduzir("Trazendo as conversas do celular")}
        {total != null ? `: ${historico.chatsProcessados} de ${total}` : "…"}
        {total != null ? "." : ""}
        {!pausado ? " Pode fechar esta tela: ela continua sozinha." : ""}
      </p>
      <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={pausado ? onRetomar : onPausar}>
        {pausado ? "Retomar" : "Pausar"}
      </button>
    </div>
  );
}

