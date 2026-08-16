"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Estado persistido de toda a tela de Configurações — banco de verdade (`PUT /api/preferencias/{chave}`,
 * debounced), não localStorage. Um context só pra não espalhar 20 providers novos no layout pra 20
 * categorias que, na prática, são todas "preferências do workspace" salvas no mesmo blob JSON.
 */

export type AzuzIaConfig = {
  tom: "direto" | "consultivo" | "amigavel" | "formal" | "personalizado";
  detalhamento: "resumido" | "equilibrado" | "detalhado";
  sugestoesProativas: boolean;
  dadosPermitidos: string[];
  sugestoesTipos: string[];
  comportamentoPersonalizado: string;
};

export type ConfiguracoesEstado = {
  azuzIa: AzuzIaConfig;
  /** Entidades simples criadas nas telas de gestão (equipes, funções, campos, etiquetas) — cada uma
   * guarda só o essencial, tudo mockado/local. */
  funcoesPersonalizadas: { id: string; nome: string; descricao: string; cor: string; baseadaEm: string }[];
  equipesPersonalizadas: { id: string; nome: string; descricao: string; gestor: string; cor: string; metodoDistribuicao: string }[];
  camposPersonalizados: { id: string; nome: string; tipo: string; objeto: string; obrigatorio: boolean; visivel: boolean }[];
  etiquetasPersonalizadas: { id: string; nome: string; cor: string }[];
};

/** Preferências (banco real, ver src/app/api/preferencias/) — chave desse blob na tabela `Preferencia`. */
const CHAVE_PREFERENCIA = "configuracoes";

const AZUZ_IA_PADRAO: AzuzIaConfig = {
  tom: "consultivo",
  detalhamento: "equilibrado",
  sugestoesProativas: true,
  dadosPermitidos: ["contatos", "conversas", "funis", "tarefas"],
  sugestoesTipos: ["follow-ups", "tarefas", "mudanças de etapa"],
  comportamentoPersonalizado: "",
};

const ESTADO_PADRAO: ConfiguracoesEstado = {
  azuzIa: AZUZ_IA_PADRAO,
  funcoesPersonalizadas: [],
  equipesPersonalizadas: [],
  camposPersonalizados: [],
  etiquetasPersonalizadas: [],
};

type ConfiguracoesContextValue = {
  estado: ConfiguracoesEstado;
  /** Rascunho não salvo em alguma seção (Automações/Azuz IA) — usado pelo painel de Configurações
   * pra confirmar antes de trocar de categoria e descartar a edição em andamento. */
  categoriaSuja: boolean;
  setCategoriaSuja: (valor: boolean) => void;
  atualizarAzuzIa: (patch: Partial<AzuzIaConfig>) => void;
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
      azuzIa: { ...AZUZ_IA_PADRAO, ...parsed.azuzIa },
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

  function atualizarAzuzIa(patch: Partial<AzuzIaConfig>) {
    setEstado((prev) => ({ ...prev, azuzIa: { ...prev.azuzIa, ...patch } }));
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
        atualizarAzuzIa,
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
