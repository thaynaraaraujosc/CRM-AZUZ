"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { workspace } from "@/lib/data";

/**
 * Estado persistido de toda a tela de Configurações — front-end apenas, seguindo o mesmo padrão de
 * localStorage já usado em `formularios-context.tsx`/`documentos-context.tsx` (chave própria,
 * hidratação em duas etapas, try/catch silencioso). Um context só pra não espalhar 20 providers
 * novos no layout pra 20 categorias que, na prática, são todas "preferências do workspace".
 */

export type TemaAparencia = "claro" | "escuro" | "sistema";
export type DensidadeAparencia = "compacta" | "confortavel" | "espacosa";
export type TamanhoAparencia = "pequeno" | "padrao" | "grande";
export type MenuLateralModo = "expandido" | "recolhido" | "automatico";

export type WorkspaceConfig = {
  nome: string;
  nomeEmpresa: string;
  segmento: string;
  pais: string;
  estado: string;
  cidade: string;
  fusoHorario: string;
  idioma: string;
  moeda: string;
  formatoData: string;
  formatoHora: string;
  semanaComecaEm: "domingo" | "segunda";
  logoUrl: string | null;
  nomeCurto: string;
  corPrincipal: string;
  corSecundaria: string;
  corDestaque: string;
};

export type AparenciaConfig = {
  tema: TemaAparencia;
  densidade: DensidadeAparencia;
  tamanho: TamanhoAparencia;
  menuLateral: MenuLateralModo;
};

export type FrequenciaNotificacao = "imediatamente" | "resumo_diario" | "resumo_semanal" | "desativado";

export type PreferenciaEvento = {
  dentroCrm: boolean;
  email: boolean;
  push: boolean;
  whatsapp: boolean;
  frequencia: FrequenciaNotificacao;
};

export type AutomacoesPrefsConfig = {
  permitirAtivacaoSemTeste: boolean;
  exigirValidacaoAntesAtivar: boolean;
  registrarHistorico: boolean;
  pausarEmErro: boolean;
  impedirDuplicadas: boolean;
  horarioInicio: string;
  horarioFim: string;
  limiteAcoes: number;
  responsavelPadrao: string;
  funilPadrao: string;
  comportamentoEtapaRemovida: "mover_padrao" | "pausar_automacao";
  modoConstrucao: "guiado" | "avancado" | "lembrar";
  explicacoesAutomaticas: boolean;
  mostrarResumo: "sempre" | "ao_testar" | "nunca";
};

export type AzuzIaConfig = {
  tom: "direto" | "consultivo" | "amigavel" | "formal" | "personalizado";
  detalhamento: "resumido" | "equilibrado" | "detalhado";
  sugestoesProativas: boolean;
  dadosPermitidos: string[];
  sugestoesTipos: string[];
  comportamentoPersonalizado: string;
};

export type SegurancaConfig = {
  doisFatores: boolean;
  politicaSenhaForte: boolean;
  expirarSessaoMin: number;
  bloquearAposTentativas: number;
  restringirPorFuncao: boolean;
};

export type ConfiguracoesEstado = {
  workspace: WorkspaceConfig;
  aparencia: AparenciaConfig;
  notificacoes: Record<string, PreferenciaEvento>;
  automacoesPrefs: AutomacoesPrefsConfig;
  azuzIa: AzuzIaConfig;
  seguranca: SegurancaConfig;
  /** Entidades simples criadas nas telas de gestão (equipes, funções, campos, etiquetas) — cada uma
   * guarda só o essencial, tudo mockado/local. */
  funcoesPersonalizadas: { id: string; nome: string; descricao: string; cor: string; baseadaEm: string }[];
  equipesPersonalizadas: { id: string; nome: string; descricao: string; gestor: string; cor: string; metodoDistribuicao: string }[];
  camposPersonalizados: { id: string; nome: string; tipo: string; objeto: string; obrigatorio: boolean; visivel: boolean }[];
  etiquetasPersonalizadas: { id: string; nome: string; cor: string }[];
};

/** Preferências (banco real, ver src/app/api/preferencias/) — chave desse blob na tabela `Preferencia`. */
const CHAVE_PREFERENCIA = "configuracoes";

export const WORKSPACE_CONFIG_PADRAO: WorkspaceConfig = {
  nome: workspace.name,
  nomeEmpresa: workspace.name,
  segmento: workspace.segment,
  pais: "Brasil",
  estado: "Goiás",
  cidade: "Goiânia",
  fusoHorario: "America/Sao_Paulo",
  idioma: "Português (Brasil)",
  moeda: "BRL (R$)",
  formatoData: "DD/MM/AAAA",
  formatoHora: "24 horas",
  semanaComecaEm: "domingo",
  logoUrl: null,
  nomeCurto: workspace.name.split(" ")[0] ?? workspace.name,
  corPrincipal: "#2e6bff",
  corSecundaria: "#0b1a3a",
  corDestaque: "#0f9d63",
};

const APARENCIA_PADRAO: AparenciaConfig = {
  tema: "sistema",
  densidade: "confortavel",
  tamanho: "padrao",
  menuLateral: "expandido",
};

export const EVENTOS_NOTIFICACAO: { id: string; label: string }[] = [
  { id: "novo_lead", label: "Novo lead" },
  { id: "lead_sem_responsavel", label: "Lead sem responsável" },
  { id: "nova_mensagem", label: "Nova mensagem" },
  { id: "tarefa_vencida", label: "Tarefa vencida" },
  { id: "proposta_vencendo", label: "Proposta próxima do vencimento" },
  { id: "negocio_ganho", label: "Negócio ganho" },
  { id: "negocio_perdido", label: "Negócio perdido" },
  { id: "automacao_erro", label: "Automação com erro" },
  { id: "meta_atingida", label: "Meta atingida" },
  { id: "tempo_resposta", label: "Tempo de resposta acima da meta" },
];

const NOTIFICACOES_PADRAO: Record<string, PreferenciaEvento> = Object.fromEntries(
  EVENTOS_NOTIFICACAO.map((e) => [
    e.id,
    { dentroCrm: true, email: e.id === "negocio_ganho" || e.id === "meta_atingida", push: false, whatsapp: false, frequencia: "imediatamente" as FrequenciaNotificacao },
  ]),
);

const AUTOMACOES_PREFS_PADRAO: AutomacoesPrefsConfig = {
  permitirAtivacaoSemTeste: false,
  exigirValidacaoAntesAtivar: true,
  registrarHistorico: true,
  pausarEmErro: true,
  impedirDuplicadas: true,
  horarioInicio: "08:00",
  horarioFim: "20:00",
  limiteAcoes: 500,
  responsavelPadrao: "Ana Ferreira",
  funilPadrao: "Funil principal",
  comportamentoEtapaRemovida: "pausar_automacao",
  modoConstrucao: "lembrar",
  explicacoesAutomaticas: true,
  mostrarResumo: "sempre",
};

const AZUZ_IA_PADRAO: AzuzIaConfig = {
  tom: "consultivo",
  detalhamento: "equilibrado",
  sugestoesProativas: true,
  dadosPermitidos: ["contatos", "conversas", "funis", "tarefas"],
  sugestoesTipos: ["follow-ups", "tarefas", "mudanças de etapa"],
  comportamentoPersonalizado: "",
};

const SEGURANCA_PADRAO: SegurancaConfig = {
  doisFatores: false,
  politicaSenhaForte: true,
  expirarSessaoMin: 480,
  bloquearAposTentativas: 5,
  restringirPorFuncao: true,
};

const ESTADO_PADRAO: ConfiguracoesEstado = {
  workspace: WORKSPACE_CONFIG_PADRAO,
  aparencia: APARENCIA_PADRAO,
  notificacoes: NOTIFICACOES_PADRAO,
  automacoesPrefs: AUTOMACOES_PREFS_PADRAO,
  azuzIa: AZUZ_IA_PADRAO,
  seguranca: SEGURANCA_PADRAO,
  funcoesPersonalizadas: [],
  equipesPersonalizadas: [],
  camposPersonalizados: [],
  etiquetasPersonalizadas: [],
};

type ConfiguracoesContextValue = {
  estado: ConfiguracoesEstado;
  /** Rascunho não salvo em alguma seção (Workspace/Automações/Azuz IA) — usado pelo painel de
   * Configurações pra confirmar antes de trocar de categoria e descartar a edição em andamento. */
  categoriaSuja: boolean;
  setCategoriaSuja: (valor: boolean) => void;
  atualizarWorkspace: (patch: Partial<WorkspaceConfig>) => void;
  atualizarAparencia: (patch: Partial<AparenciaConfig>) => void;
  atualizarNotificacao: (eventoId: string, patch: Partial<PreferenciaEvento>) => void;
  atualizarAutomacoesPrefs: (patch: Partial<AutomacoesPrefsConfig>) => void;
  atualizarAzuzIa: (patch: Partial<AzuzIaConfig>) => void;
  atualizarSeguranca: (patch: Partial<SegurancaConfig>) => void;
  adicionarFuncao: (f: Omit<ConfiguracoesEstado["funcoesPersonalizadas"][number], "id">) => void;
  removerFuncao: (id: string) => void;
  adicionarEquipe: (e: Omit<ConfiguracoesEstado["equipesPersonalizadas"][number], "id">) => void;
  removerEquipe: (id: string) => void;
  adicionarCampo: (c: Omit<ConfiguracoesEstado["camposPersonalizados"][number], "id">) => void;
  removerCampo: (id: string) => void;
  adicionarEtiqueta: (t: Omit<ConfiguracoesEstado["etiquetasPersonalizadas"][number], "id">) => void;
  removerEtiqueta: (id: string) => void;
};

const ConfiguracoesContext = createContext<ConfiguracoesContextValue | null>(null);

async function carregarEstado(): Promise<ConfiguracoesEstado> {
  try {
    const resposta = await fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`);
    const parsed = (await resposta.json()) as Partial<ConfiguracoesEstado>;
    return {
      workspace: { ...WORKSPACE_CONFIG_PADRAO, ...parsed.workspace },
      aparencia: { ...APARENCIA_PADRAO, ...parsed.aparencia },
      notificacoes: { ...NOTIFICACOES_PADRAO, ...parsed.notificacoes },
      automacoesPrefs: { ...AUTOMACOES_PREFS_PADRAO, ...parsed.automacoesPrefs },
      azuzIa: { ...AZUZ_IA_PADRAO, ...parsed.azuzIa },
      seguranca: { ...SEGURANCA_PADRAO, ...parsed.seguranca },
      funcoesPersonalizadas: parsed.funcoesPersonalizadas ?? [],
      equipesPersonalizadas: parsed.equipesPersonalizadas ?? [],
      camposPersonalizados: parsed.camposPersonalizados ?? [],
      etiquetasPersonalizadas: parsed.etiquetasPersonalizadas ?? [],
    };
  } catch {
    return ESTADO_PADRAO;
  }
}

let contadorId = 0;
function novoId(prefixo: string): string {
  contadorId += 1;
  return `${prefixo}-${Date.now()}-${contadorId}`;
}

export function ConfiguracoesProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<ConfiguracoesEstado>(ESTADO_PADRAO);
  const [categoriaSuja, setCategoriaSuja] = useState(false);
  const hidratadoRef = useRef(false);

  useEffect(() => {
    carregarEstado()
      .then((carregado) => {
        setEstado(carregado);
        hidratadoRef.current = true;
      })
      .catch((erro) => console.error("Falha ao carregar configurações:", erro));
  }, []);

  useEffect(() => {
    if (!hidratadoRef.current) return;
    const temporizador = setTimeout(() => {
      fetch(`/api/preferencias/${CHAVE_PREFERENCIA}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(estado),
      }).catch((erro) => console.error("Falha ao salvar configurações:", erro));
    }, 400);
    return () => clearTimeout(temporizador);
  }, [estado]);

  function atualizarWorkspace(patch: Partial<WorkspaceConfig>) {
    setEstado((prev) => ({ ...prev, workspace: { ...prev.workspace, ...patch } }));
  }
  function atualizarAparencia(patch: Partial<AparenciaConfig>) {
    setEstado((prev) => ({ ...prev, aparencia: { ...prev.aparencia, ...patch } }));
  }
  function atualizarNotificacao(eventoId: string, patch: Partial<PreferenciaEvento>) {
    setEstado((prev) => ({
      ...prev,
      notificacoes: { ...prev.notificacoes, [eventoId]: { ...prev.notificacoes[eventoId], ...patch } },
    }));
  }
  function atualizarAutomacoesPrefs(patch: Partial<AutomacoesPrefsConfig>) {
    setEstado((prev) => ({ ...prev, automacoesPrefs: { ...prev.automacoesPrefs, ...patch } }));
  }
  function atualizarAzuzIa(patch: Partial<AzuzIaConfig>) {
    setEstado((prev) => ({ ...prev, azuzIa: { ...prev.azuzIa, ...patch } }));
  }
  function atualizarSeguranca(patch: Partial<SegurancaConfig>) {
    setEstado((prev) => ({ ...prev, seguranca: { ...prev.seguranca, ...patch } }));
  }
  function adicionarFuncao(f: Omit<ConfiguracoesEstado["funcoesPersonalizadas"][number], "id">) {
    setEstado((prev) => ({ ...prev, funcoesPersonalizadas: [...prev.funcoesPersonalizadas, { ...f, id: novoId("funcao") }] }));
  }
  function removerFuncao(id: string) {
    setEstado((prev) => ({ ...prev, funcoesPersonalizadas: prev.funcoesPersonalizadas.filter((f) => f.id !== id) }));
  }
  function adicionarEquipe(e: Omit<ConfiguracoesEstado["equipesPersonalizadas"][number], "id">) {
    setEstado((prev) => ({ ...prev, equipesPersonalizadas: [...prev.equipesPersonalizadas, { ...e, id: novoId("equipe") }] }));
  }
  function removerEquipe(id: string) {
    setEstado((prev) => ({ ...prev, equipesPersonalizadas: prev.equipesPersonalizadas.filter((e) => e.id !== id) }));
  }
  function adicionarCampo(c: Omit<ConfiguracoesEstado["camposPersonalizados"][number], "id">) {
    setEstado((prev) => ({ ...prev, camposPersonalizados: [...prev.camposPersonalizados, { ...c, id: novoId("campo") }] }));
  }
  function removerCampo(id: string) {
    setEstado((prev) => ({ ...prev, camposPersonalizados: prev.camposPersonalizados.filter((c) => c.id !== id) }));
  }
  function adicionarEtiqueta(t: Omit<ConfiguracoesEstado["etiquetasPersonalizadas"][number], "id">) {
    setEstado((prev) => ({ ...prev, etiquetasPersonalizadas: [...prev.etiquetasPersonalizadas, { ...t, id: novoId("etiqueta") }] }));
  }
  function removerEtiqueta(id: string) {
    setEstado((prev) => ({ ...prev, etiquetasPersonalizadas: prev.etiquetasPersonalizadas.filter((t) => t.id !== id) }));
  }

  return (
    <ConfiguracoesContext.Provider
      value={{
        estado,
        categoriaSuja,
        setCategoriaSuja,
        atualizarWorkspace,
        atualizarAparencia,
        atualizarNotificacao,
        atualizarAutomacoesPrefs,
        atualizarAzuzIa,
        atualizarSeguranca,
        adicionarFuncao,
        removerFuncao,
        adicionarEquipe,
        removerEquipe,
        adicionarCampo,
        removerCampo,
        adicionarEtiqueta,
        removerEtiqueta,
      }}
    >
      {children}
    </ConfiguracoesContext.Provider>
  );
}

export function useConfiguracoes() {
  const ctx = useContext(ConfiguracoesContext);
  if (!ctx) throw new Error("useConfiguracoes precisa estar dentro de ConfiguracoesProvider");
  return ctx;
}
