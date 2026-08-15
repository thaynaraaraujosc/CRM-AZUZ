"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type {
  CanalComentario,
  DiaSemana,
  Origem,
  TipoAcaoAutomacao,
  TipoGatilhoEtapa,
} from "@/lib/data";

export type OpcaoResposta = {
  id: string;
  rotulo: string;
  /**
   * Ações extras que rodam só quando o lead escolhe essa opção — é o que permite
   * "se ele responder 1, faz isso; se responder 2, faz aquilo" numa mensagem
   * interativa. Pode conter outra "mensagem_interativa" dentro, ramificando de novo.
   */
  acoesSeEscolhida?: AcaoAutomacao[];
};

export type AcaoAutomacao = {
  id: string;
  tipo: TipoAcaoAutomacao;
  /** Usado por "mensagem", "mensagem_interativa", "enviar_formulario" (texto opcional) e "tarefa". */
  mensagem?: string;
  /** Usado só por "mensagem_interativa" — as opções de resposta que o lead pode escolher. */
  opcoes?: OpcaoResposta[];
  /** Usado por "documento" e "audio" — nome do arquivo escolhido/gravado. */
  arquivoNome?: string;
  /** Usado por "lembrete" (quando dispara) e "tarefa" (prazo). */
  tempoValor?: string;
  tempoUnidade?: string;
  /** Usado por "mover_funil". */
  moverFunilId?: string;
  moverEtapaTitulo?: string;
  /** Usado por "atribuir_responsavel" — nome de alguém em `equipe` (src/lib/data.ts). */
  atendenteNome?: string;
  /** Usado por "enviar_formulario" — formulário do próprio CRM ou um link externo. */
  formularioOrigem?: "interno" | "externo";
  /** Id de um formulário em `formularios` (FormulariosContext) quando `formularioOrigem === "interno"`. */
  formularioId?: string;
  /** URL quando `formularioOrigem === "externo"`. */
  formularioUrlExterna?: string;
  /** Usado por "adicionar_etiqueta" e "remover_etiqueta". */
  etiquetaNome?: string;
  /** Usado por "webhook". */
  webhookUrl?: string;
  /** Espera antes de executar essa ação — aplica a qualquer tipo. */
  atrasoValor?: string;
  atrasoUnidade?: string;
};

export type ComportamentoForaJanela = "aguardar" | "ignorar";
export type LimiteExecucao = "sempre" | "uma_vez";

export type Automacao = {
  id: string;
  funilId: string;
  etapaId: string;
  titulo: string;
  gatilhoTipo: TipoGatilhoEtapa;
  /**
   * Pra gatilhos com `precisaTempo` (ex. "parado"), é obrigatório e define
   * depois de quanto tempo dispara. Pra gatilhos com `permiteAtraso` (ex.
   * "entrou"), só é usado quando `disparoImediato` é false.
   */
  tempoValor?: string;
  tempoUnidade?: string;
  /**
   * Pra gatilhos com `permiteAtraso` — false significa "espera o tempo de
   * `tempoValor`/`tempoUnidade` antes de disparar" em vez de disparar na
   * hora que o gatilho acontece. Undefined/true = dispara imediatamente.
   */
  disparoImediato?: boolean;
  acoes: AcaoAutomacao[];
  ativa: boolean;
  execucoes: string;

  /** Janela de atividade — em quais dias essa automação pode disparar. Sem valor = todos os dias. */
  diasAtivos?: DiaSemana[];
  /** Restringe o disparo a um intervalo de horário dentro dos dias ativos. */
  usarHorario?: boolean;
  horarioInicio?: string;
  horarioFim?: string;
  /** O que fazer quando o gatilho acontece fora da janela de dias/horário. */
  foraDaJanela?: ComportamentoForaJanela;

  /** Condições opcionais — só dispara se o lead bater com elas. Vazio/"" = sem filtro. */
  condicaoOrigem?: Origem | "";
  condicaoValorMinimo?: string;
  /**
   * Só dispara se o lead ainda não respondeu nenhuma mensagem desde que entrou nessa
   * etapa — é o que permite montar a cascata "lembra em 24h, se não responder
   * desqualifica em 72h": duas automações com gatilho "parado" em tempos diferentes,
   * ambas com essa condição marcada.
   */
  condicaoSemResposta?: boolean;

  /** Quantas vezes essa automação pode rodar pro mesmo contato. */
  limiteExecucao?: LimiteExecucao;
};

/** Regra do tipo "comentou uma palavra-chave no post → recebe direct automático". */
export type RegraComentario = {
  id: string;
  canal: CanalComentario;
  palavraChave: string;
  mensagemDirect: string;
  ativa: boolean;
  execucoes: string;
};

type AutomacoesContextValue = {
  automacoes: Automacao[];
  automacoesDaEtapa: (funilId: string, etapaId: string) => Automacao[];
  /** Automações com gatilho "entrou" e ativas — usado pra simular o disparo ao soltar um card na coluna. */
  automacoesDeEntradaAtivas: (funilId: string, etapaId: string) => Automacao[];
  criarAutomacao: (dados: Omit<Automacao, "id" | "execucoes">) => void;
  atualizarAutomacao: (
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) => void;
  excluirAutomacao: (automacaoId: string) => void;
  alternarAtiva: (automacaoId: string) => void;
  /** Chamado quando uma etapa é apagada — some com as automações que só faziam sentido nela. */
  excluirAutomacoesDaEtapa: (funilId: string, etapaId: string) => void;
  /** Chamado quando um funil inteiro é apagado. */
  excluirAutomacoesDoFunil: (funilId: string) => void;

  regrasComentario: RegraComentario[];
  criarRegraComentario: (dados: Omit<RegraComentario, "id" | "execucoes">) => void;
  atualizarRegraComentario: (
    regraId: string,
    dados: Partial<Omit<RegraComentario, "id">>,
  ) => void;
  excluirRegraComentario: (regraId: string) => void;
  alternarRegraComentarioAtiva: (regraId: string) => void;
};

const AutomacoesContext = createContext<AutomacoesContextValue | null>(null);

/** Exportadas (não só usadas aqui dentro) pra `automation-flow/migracao.ts` conseguir migrar o seed pro formato novo. */
export const AUTOMACOES_INICIAIS: Automacao[] = [
  {
    id: "auto-boas-vindas",
    funilId: "funil-principal",
    etapaId: "novo",
    titulo: "Boas-vindas pro lead novo",
    gatilhoTipo: "entrou",
    acoes: [
      {
        id: "acao-boas-vindas-msg",
        tipo: "mensagem_interativa",
        mensagem:
          "Oi! Recebemos sua mensagem 💙 Antes de continuar, me conta uma coisa:",
        opcoes: [
          {
            id: "op-1",
            rotulo: "1 · Já sou paciente da clínica",
            /** Ramo disparado só pra quem responde essa opção. */
            acoesSeEscolhida: [
              {
                id: "acao-boas-vindas-op1-msg",
                tipo: "mensagem",
                mensagem:
                  "Que bom te ver de novo por aqui! Já vou te encaminhar direto pro seu atendente de confiança 💙",
              },
              {
                id: "acao-boas-vindas-op1-etiqueta",
                tipo: "adicionar_etiqueta",
                etiquetaNome: "Paciente recorrente",
              },
            ],
          },
          {
            id: "op-2",
            rotulo: "2 · É minha primeira vez por aqui",
            /** Ramo disparado só pra quem responde essa outra opção. */
            acoesSeEscolhida: [
              {
                id: "acao-boas-vindas-op2-msg",
                tipo: "mensagem",
                mensagem:
                  "Seja muito bem-vindo(a)! Vou te mandar as informações da clínica e já te encaixar numa triagem rapidinha.",
              },
              {
                id: "acao-boas-vindas-op2-tarefa",
                tipo: "tarefa",
                mensagem: "Fazer a triagem inicial do lead novo",
                tempoValor: "1",
                tempoUnidade: "dias",
              },
            ],
          },
        ],
      },
    ],
    ativa: true,
    execucoes: "312 execuções",
  },
  {
    id: "auto-proposta-lembrete-24h",
    funilId: "funil-principal",
    etapaId: "proposta",
    titulo: "Lembrete de proposta parada — 24h",
    gatilhoTipo: "parado",
    tempoValor: "24",
    tempoUnidade: "horas",
    condicaoSemResposta: true,
    acoes: [
      {
        id: "acao-proposta-lembrete",
        tipo: "lembrete",
        mensagem: "Retomar contato — proposta enviada sem resposta",
        tempoValor: "24",
        tempoUnidade: "horas",
      },
      {
        id: "acao-proposta-msg",
        tipo: "mensagem",
        mensagem: "Oi! Ainda tem interesse na proposta que te enviamos? 🙂",
      },
    ],
    ativa: true,
    execucoes: "28 execuções",
  },
];

export const REGRAS_COMENTARIO_INICIAIS: RegraComentario[] = [
  {
    id: "regra-quero-agendar",
    canal: "Instagram",
    palavraChave: "QUERO",
    mensagemDirect:
      "Oi! Vi seu comentário 💙 Aqui está o link pra agendar seu horário: seusite.com.br/agendar",
    ativa: true,
    execucoes: "18 execuções",
  },
];

/**
 * Automações agora vivem dentro da etapa de um funil (não numa aba separada
 * por funil) — cada card de automação mostra o gatilho + as ações dentro da
 * coluna do Kanban, igual /funil. Apagar a etapa ou o funil apaga junto as
 * automações que só faziam sentido ali.
 */
export function AutomacoesProvider({ children }: { children: ReactNode }) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>(AUTOMACOES_INICIAIS);
  const [regrasComentario, setRegrasComentario] = useState<RegraComentario[]>(
    REGRAS_COMENTARIO_INICIAIS,
  );

  function automacoesDaEtapa(funilId: string, etapaId: string) {
    return automacoes.filter(
      (a) => a.funilId === funilId && a.etapaId === etapaId,
    );
  }

  function automacoesDeEntradaAtivas(funilId: string, etapaId: string) {
    return automacoes.filter(
      (a) =>
        a.funilId === funilId &&
        a.etapaId === etapaId &&
        a.gatilhoTipo === "entrou" &&
        a.ativa,
    );
  }

  function criarAutomacao(dados: Omit<Automacao, "id" | "execucoes">) {
    setAutomacoes((prev) => [
      ...prev,
      { ...dados, id: `auto-${Date.now()}`, execucoes: "0 execuções" },
    ]);
  }

  function atualizarAutomacao(
    automacaoId: string,
    dados: Partial<Omit<Automacao, "id">>,
  ) {
    setAutomacoes((prev) =>
      prev.map((a) => (a.id === automacaoId ? { ...a, ...dados } : a)),
    );
  }

  function excluirAutomacao(automacaoId: string) {
    setAutomacoes((prev) => prev.filter((a) => a.id !== automacaoId));
  }

  function alternarAtiva(automacaoId: string) {
    setAutomacoes((prev) =>
      prev.map((a) => (a.id === automacaoId ? { ...a, ativa: !a.ativa } : a)),
    );
  }

  function excluirAutomacoesDaEtapa(funilId: string, etapaId: string) {
    setAutomacoes((prev) =>
      prev.filter((a) => !(a.funilId === funilId && a.etapaId === etapaId)),
    );
  }

  function excluirAutomacoesDoFunil(funilId: string) {
    setAutomacoes((prev) => prev.filter((a) => a.funilId !== funilId));
  }

  function criarRegraComentario(dados: Omit<RegraComentario, "id" | "execucoes">) {
    setRegrasComentario((prev) => [
      ...prev,
      { ...dados, id: `regra-${Date.now()}`, execucoes: "0 execuções" },
    ]);
  }

  function atualizarRegraComentario(
    regraId: string,
    dados: Partial<Omit<RegraComentario, "id">>,
  ) {
    setRegrasComentario((prev) =>
      prev.map((r) => (r.id === regraId ? { ...r, ...dados } : r)),
    );
  }

  function excluirRegraComentario(regraId: string) {
    setRegrasComentario((prev) => prev.filter((r) => r.id !== regraId));
  }

  function alternarRegraComentarioAtiva(regraId: string) {
    setRegrasComentario((prev) =>
      prev.map((r) => (r.id === regraId ? { ...r, ativa: !r.ativa } : r)),
    );
  }

  return (
    <AutomacoesContext.Provider
      value={{
        automacoes,
        automacoesDaEtapa,
        automacoesDeEntradaAtivas,
        criarAutomacao,
        atualizarAutomacao,
        excluirAutomacao,
        alternarAtiva,
        excluirAutomacoesDaEtapa,
        excluirAutomacoesDoFunil,
        regrasComentario,
        criarRegraComentario,
        atualizarRegraComentario,
        excluirRegraComentario,
        alternarRegraComentarioAtiva,
      }}
    >
      {children}
    </AutomacoesContext.Provider>
  );
}

export function useAutomacoes() {
  const ctx = useContext(AutomacoesContext);
  if (!ctx) {
    throw new Error("useAutomacoes precisa estar dentro de AutomacoesProvider");
  }
  return ctx;
}
