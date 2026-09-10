"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { funis as funisIniciais } from "@/lib/data";
import {
  AUTOMACOES_INICIAIS,
  REGRAS_COMENTARIO_INICIAIS,
} from "@/lib/automacoes-context";

import { migrarAutomacaoParaFluxo, migrarRegraComentarioParaFluxo } from "./automation-flow/migracao";
import { FLUXOS_DEMONSTRACAO_INICIAIS } from "./automation-flow/demo-fluxos";
import { validarFluxo } from "./automation-flow/validacao";
import type {
  ConfiguracoesFluxo,
  FluxoAutomacao,
  FlowEdge,
  FlowNode,
  ProblemaValidacao,
  RegistroExecucao,
  VersaoFluxo,
} from "./automation-flow/types";

type PatchFluxo = Partial<{
  nome: string;
  descricao: string;
  funilId: string;
  etapaId: string;
  categoria: string;
  /** Mover o robô de pasta. `null` devolve pra lista principal. */
  pastaId: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
}>;

type AutomationFlowContextValue = {
  fluxos: FluxoAutomacao[];
  /** A lista já veio do servidor pelo menos uma vez. Antes disso, "não achei" não quer dizer nada. */
  carregado: boolean;
  /**
   * Busca a lista de novo.
   *
   * Existe porque nem todo robô nasce por aqui: o botão "Criar um novo robô" da grade do funil cria
   * direto no banco, por outra rota. Sem uma forma de recarregar, esse robô não existia pra esta
   * tela até a página inteira ser recarregada, e abrir o editor dele dava "esse fluxo não existe".
   */
  recarregarFluxos: () => Promise<void>;
  criarFluxo: (dados: Partial<Omit<FluxoAutomacao, "id">> & { nome: string }) => FluxoAutomacao;
  /** Sempre escreve no rascunho (nodes/edges/configuracoes). Nunca mexe em `status`/versão publicada. */
  atualizarFluxo: (id: string, patch: PatchFluxo) => void;
  /** Valida; se não houver erro (severidade "erro"), publica uma nova versão. Retorna os problemas achados de qualquer forma. */
  publicarFluxo: (id: string, usuario: string) => ProblemaValidacao[];
  restaurarVersao: (fluxoId: string, versao: number) => void;
  /** Retorna a cópia recém-criada (rascunho independente). Útil pra navegar direto pro editor dela. Aditivo: quem já chamava sem usar o retorno continua funcionando igual. */
  duplicarFluxo: (id: string) => FluxoAutomacao | undefined;
  /** Arquiva: pausa (`ativa: false`) E marca `arquivada: true`. Some da lista principal (ver automacoes/page.tsx). */
  arquivarFluxo: (id: string) => void;
  /** Desfaz o arquivamento: volta a aparecer na lista principal. Não reativa sozinho (`ativa` continua false; usuário liga pelo Toggle se quiser). */
  desarquivarFluxo: (id: string) => void;
  excluirFluxo: (id: string) => void;
  alternarAtivo: (id: string) => void;

  execucoes: RegistroExecucao[];
  registrarExecucao: (registro: RegistroExecucao) => void;
  execucoesDoFluxo: (fluxoId: string) => RegistroExecucao[];

  /**
   * Ponto de entrada único pra disparar automações a partir de um evento real do
   * CRM (entrou na etapa, respondeu, etc): testa todo fluxo publicado e ativo
   * contra o evento e, pra cada acerto, roda o motor de execução de verdade.
   */
};

const AutomationFlowContext = createContext<AutomationFlowContextValue | null>(null);

function agoraISO(): string {
  return new Date().toISOString();
}

/** Exportado só pra `prisma/seed.ts` semear a tabela. O Provider agora busca da API. */
export function fluxosIniciaisPadrao(): FluxoAutomacao[] {
  return [
    ...AUTOMACOES_INICIAIS.map((a) => migrarAutomacaoParaFluxo(a, funisIniciais)),
    ...REGRAS_COMENTARIO_INICIAIS.map((r) => migrarRegraComentarioParaFluxo(r)),
    ...FLUXOS_DEMONSTRACAO_INICIAIS,
  ];
}

/**
 * Banco real (ver src/app/api/automacoes-fluxos/): nodes/edges/configuracoes/historicoVersoes
 * ficam como Json na própria linha do fluxo, já que os mutadores sempre recalculam o objeto inteiro
 * e substituem. `execucoes` (log de auditoria do Simulador/Histórico) continua só em memória. Nunca
 * persistiu, sem mudança de comportamento.
 */
function criarRemoto(fluxo: FluxoAutomacao) {
  fetch("/api/automacoes-fluxos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fluxo),
  }).catch((erro) => console.error("Falha ao criar fluxo de automação na API:", erro));
}

export function AutomationFlowProvider({ children }: { children: ReactNode }) {
  const [fluxos, setFluxos] = useState<FluxoAutomacao[]>([]);
  const [execucoes, setExecucoes] = useState<RegistroExecucao[]>([]);
  /**
   * A lista já foi buscada pelo menos uma vez?
   *
   * Sem isso não dá pra distinguir "ainda não carregou" de "não existe", e quem abre o editor no
   * meio da carga vê "esse fluxo não existe" no lugar de esperar meio segundo.
   */
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    const resposta = await fetch("/api/automacoes-fluxos", { cache: "no-store" });
    if (!resposta.ok) throw new Error(`A lista de fluxos respondeu ${resposta.status}.`);
    setFluxos((await resposta.json()) as FluxoAutomacao[]);
    setCarregado(true);
  }, []);

  useEffect(() => {
    // Referência, não chamada: o `setState` fica dentro do `then`, fora do corpo do efeito. É o
    // mesmo padrão usado no resto do CRM, e o que a regra do React 19 pede.
    Promise.resolve()
      .then(recarregar)
      .catch((erro) => console.error("Falha ao carregar fluxos de automação da API:", erro));
  }, [recarregar]);

  function tocarFluxo(id: string, atualizar: (f: FluxoAutomacao) => FluxoAutomacao) {
    let atualizado: FluxoAutomacao | undefined;
    setFluxos((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        atualizado = atualizar(f);
        return atualizado;
      }),
    );
    if (atualizado) {
      fetch(`/api/automacoes-fluxos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizado),
      }).catch((erro) => console.error("Falha ao atualizar fluxo de automação na API:", erro));
    }
  }

  function criarFluxo(dados: Partial<Omit<FluxoAutomacao, "id">> & { nome: string }): FluxoAutomacao {
    const agora = agoraISO();
    const novo: FluxoAutomacao = {
      id: `fluxo-${Date.now()}`,
      nome: dados.nome,
      descricao: dados.descricao,
      funilId: dados.funilId,
      etapaId: dados.etapaId,
      categoria: dados.categoria,
      // Comercial é o padrão porque é o que todo robô era até existir a área social.
      area: dados.area ?? "comercial",
      pastaId: dados.pastaId ?? null,
      status: "rascunho",
      ativa: dados.ativa ?? false,
      nodes: dados.nodes ?? [],
      edges: dados.edges ?? [],
      versaoAtual: 0,
      criadoEm: agora,
      atualizadoEm: agora,
      configuracoes: dados.configuracoes ?? {},
      execucoes: 0,
      historicoVersoes: [],
    };
    setFluxos((prev) => [...prev, novo]);
    criarRemoto(novo);
    return novo;
  }

  function atualizarFluxo(id: string, patch: PatchFluxo) {
    tocarFluxo(id, (f) => ({ ...f, ...patch, atualizadoEm: agoraISO() }));
  }

  function publicarFluxo(id: string, usuario: string): ProblemaValidacao[] {
    const fluxo = fluxos.find((f) => f.id === id);
    if (!fluxo) return [];

    const problemas = validarFluxo(fluxo);
    const temErro = problemas.some((p) => p.severidade === "erro");
    if (temErro) return problemas;

    tocarFluxo(id, (f) => {
      const agora = agoraISO();
      const novaVersao = f.versaoAtual + 1;
      const versao: VersaoFluxo = {
        versao: novaVersao,
        nodes: f.nodes,
        edges: f.edges,
        configuracoes: f.configuracoes,
        publicadoEm: agora,
        publicadoPor: usuario,
      };
      return {
        ...f,
        status: "publicado",
        // Na PRIMEIRA publicação, o robô já nasce ligado.
        //
        // Publicar e ativar eram dois passos, e o segundo não estava em lugar nenhum na cabeça de
        // quem acabou de clicar em "Publicar": a tela dizia "Publicado", o aviso dizia "publicado
        // com sucesso", e o robô nunca rodava porque o motor exige `ativa`. Era o caminho mais
        // curto pra concluir que a automação do CRM não funciona.
        //
        // Republicar NÃO religa nada: quem pausou o robô de propósito e depois corrigiu o texto
        // não quer que a correção o coloque no ar de volta sem avisar.
        ativa: f.versaoAtual === 0 ? true : f.ativa,
        versaoAtual: novaVersao,
        publicadoEm: agora,
        publicadoPor: usuario,
        atualizadoEm: agora,
        historicoVersoes: [...f.historicoVersoes, versao],
      };
    });
    return problemas;
  }

  function restaurarVersao(fluxoId: string, versao: number) {
    tocarFluxo(fluxoId, (f) => {
      const alvo = f.historicoVersoes.find((v) => v.versao === versao);
      if (!alvo) return f;
      return {
        ...f,
        nodes: alvo.nodes,
        edges: alvo.edges,
        configuracoes: alvo.configuracoes,
        atualizadoEm: agoraISO(),
      };
    });
  }

  function duplicarFluxo(id: string): FluxoAutomacao | undefined {
    const original = fluxos.find((f) => f.id === id);
    if (!original) return undefined;
    const agora = agoraISO();
    const copia: FluxoAutomacao = {
      ...original,
      id: `fluxo-${Date.now()}`,
      nome: `${original.nome} (cópia)`,
      status: "rascunho",
      ativa: false,
      versaoAtual: 0,
      publicadoEm: undefined,
      publicadoPor: undefined,
      criadoEm: agora,
      atualizadoEm: agora,
      execucoes: 0,
      historicoVersoes: [],
      // A cópia deixa de ser um "modelo de demonstração". Vira uma automação real do usuário.
      modeloDemonstracao: false,
    };
    setFluxos((prev) => [...prev, copia]);
    criarRemoto(copia);
    return copia;
  }

  function arquivarFluxo(id: string) {
    tocarFluxo(id, (f) => ({ ...f, ativa: false, arquivada: true, atualizadoEm: agoraISO() }));
  }

  function desarquivarFluxo(id: string) {
    tocarFluxo(id, (f) => ({ ...f, arquivada: false, atualizadoEm: agoraISO() }));
  }

  function excluirFluxo(id: string) {
    setFluxos((prev) => prev.filter((f) => f.id !== id));
    fetch(`/api/automacoes-fluxos/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir fluxo de automação na API:", erro),
    );
  }

  function alternarAtivo(id: string) {
    tocarFluxo(id, (f) => ({ ...f, ativa: !f.ativa, atualizadoEm: agoraISO() }));
  }

  function registrarExecucao(registro: RegistroExecucao) {
    setExecucoes((prev) => [...prev, registro]);
    tocarFluxo(registro.fluxoId, (f) => ({ ...f, execucoes: f.execucoes + 1 }));
  }

  function execucoesDoFluxo(fluxoId: string): RegistroExecucao[] {
    return execucoes.filter((e) => e.fluxoId === fluxoId);
  }

  return (
    <AutomationFlowContext.Provider
      value={{
        fluxos,
        carregado,
        recarregarFluxos: recarregar,
        criarFluxo,
        atualizarFluxo,
        publicarFluxo,
        restaurarVersao,
        duplicarFluxo,
        arquivarFluxo,
        desarquivarFluxo,
        excluirFluxo,
        alternarAtivo,
        execucoes,
        registrarExecucao,
        execucoesDoFluxo,
      }}
    >
      {children}
    </AutomationFlowContext.Provider>
  );
}

export function useAutomationFlows() {
  const ctx = useContext(AutomationFlowContext);
  if (!ctx) {
    throw new Error("useAutomationFlows precisa estar dentro de AutomationFlowProvider");
  }
  return ctx;
}
