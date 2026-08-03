"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Estado local da Central do Dia (página Início) — só front-end: quais itens foram concluídos ou
 * adiados, a organização sugerida do dia e os filtros selecionados. Persistido em localStorage pra
 * sobreviver a um reload, mas nunca criado como rotina no servidor (ver item 12/13/14/15 do pedido).
 */

export type PeriodoAdiamento = "mais_tarde_hoje" | "amanha" | "proxima_semana" | "data_escolhida";

export type ItemConcluido = {
  itemId: string;
  titulo: string;
  tipo: string;
  horario: string;
  usuario: string;
  acao: string;
};

export type ItemAdiado = {
  itemId: string;
  periodo: PeriodoAdiamento;
  dataEscolhida?: string;
  horaEscolhida?: string;
  criadoEm: string;
};

export type FiltrosCentralDia = {
  rapido: string;
  periodo: "hoje" | "amanha" | "semana";
  responsavel: string;
  equipe: string;
  funil: string;
  prioridade: string;
  status: string;
};

export const FILTROS_PADRAO: FiltrosCentralDia = {
  rapido: "Todos",
  periodo: "hoje",
  responsavel: "Todos",
  equipe: "Todas",
  funil: "Todos",
  prioridade: "Todas",
  status: "Todos",
};

export type OrganizacaoDia = {
  itens: string[];
  indiceAtual: number;
} | null;

type CentralDiaContextValue = {
  concluidos: ItemConcluido[];
  adiados: ItemAdiado[];
  filtros: FiltrosCentralDia;
  organizacao: OrganizacaoDia;
  toasts: { id: number; texto: string }[];
  ultimaAtualizacao: number;
  atualizando: boolean;
  avisar: (texto: string) => void;
  marcarConcluido: (item: ItemConcluido) => void;
  desfazerConcluido: (itemId: string) => void;
  limparConcluidos: () => void;
  adiarItem: (itemId: string, periodo: PeriodoAdiamento, dataEscolhida?: string, horaEscolhida?: string) => void;
  retomarItem: (itemId: string) => void;
  setFiltros: (patch: Partial<FiltrosCentralDia>) => void;
  limparFiltros: () => void;
  iniciarOrganizacao: (itens: string[]) => void;
  avancarOrganizacao: () => void;
  voltarOrganizacao: () => void;
  cancelarOrganizacao: () => void;
  atualizarAgora: () => void;
};

const CentralDiaContext = createContext<CentralDiaContextValue | null>(null);

const CHAVE_STORAGE = "azuz-crm-central-dia";

type EstadoPersistido = {
  concluidos: ItemConcluido[];
  adiados: ItemAdiado[];
  filtros: FiltrosCentralDia;
};

const ESTADO_PADRAO: EstadoPersistido = {
  concluidos: [],
  adiados: [],
  filtros: FILTROS_PADRAO,
};

function carregarEstado(): EstadoPersistido {
  if (typeof window === "undefined") return ESTADO_PADRAO;
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    if (!salvo) return ESTADO_PADRAO;
    const parsed = JSON.parse(salvo) as Partial<EstadoPersistido>;
    return {
      concluidos: parsed.concluidos ?? [],
      adiados: parsed.adiados ?? [],
      filtros: { ...FILTROS_PADRAO, ...parsed.filtros },
    };
  } catch {
    return ESTADO_PADRAO;
  }
}

export function CentralDiaProvider({ children }: { children: ReactNode }) {
  // Começa sempre com o padrão (igual ao HTML pré-renderizado) e só lê o localStorage depois de
  // montar, senão dá erro de hidratação — mesmo cuidado tomado em `inicio/page.tsx` hoje.
  const [concluidos, setConcluidos] = useState<ItemConcluido[]>(ESTADO_PADRAO.concluidos);
  const [adiados, setAdiados] = useState<ItemAdiado[]>(ESTADO_PADRAO.adiados);
  const [filtros, setFiltrosState] = useState<FiltrosCentralDia>(FILTROS_PADRAO);
  const [organizacao, setOrganizacao] = useState<OrganizacaoDia>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(() => Date.now());
  const [atualizando, setAtualizando] = useState(false);
  const toastIdRef = useRef(0);
  const hidratadoRef = useRef(false);

  useEffect(() => {
    const carregado = carregarEstado();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConcluidos(carregado.concluidos);
    setAdiados(carregado.adiados);
    setFiltrosState(carregado.filtros);
    hidratadoRef.current = true;
  }, []);

  useEffect(() => {
    if (!hidratadoRef.current) return;
    try {
      const estado: EstadoPersistido = { concluidos, adiados, filtros };
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) — segue só em memória.
    }
  }, [concluidos, adiados, filtros]);

  const avisar = useCallback((texto: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const marcarConcluido = useCallback(
    (item: ItemConcluido) => {
      setConcluidos((prev) => [item, ...prev]);
      avisar(`"${item.titulo}" marcado como resolvido.`);
    },
    [avisar],
  );

  const desfazerConcluido = useCallback((itemId: string) => {
    setConcluidos((prev) => prev.filter((c) => c.itemId !== itemId));
  }, []);

  const limparConcluidos = useCallback(() => {
    setConcluidos([]);
  }, []);

  const adiarItem = useCallback(
    (itemId: string, periodo: PeriodoAdiamento, dataEscolhida?: string, horaEscolhida?: string) => {
      setAdiados((prev) => [
        ...prev.filter((a) => a.itemId !== itemId),
        { itemId, periodo, dataEscolhida, horaEscolhida, criadoEm: new Date().toISOString() },
      ]);
      const rotulo =
        periodo === "mais_tarde_hoje"
          ? "mais tarde hoje"
          : periodo === "amanha"
            ? "amanhã"
            : periodo === "proxima_semana"
              ? "semana que vem"
              : "outra data";
      avisar(`Item adiado para ${rotulo}.`);
    },
    [avisar],
  );

  const retomarItem = useCallback((itemId: string) => {
    setAdiados((prev) => prev.filter((a) => a.itemId !== itemId));
  }, []);

  const setFiltros = useCallback((patch: Partial<FiltrosCentralDia>) => {
    setFiltrosState((prev) => ({ ...prev, ...patch }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltrosState(FILTROS_PADRAO);
  }, []);

  const iniciarOrganizacao = useCallback((itens: string[]) => {
    setOrganizacao({ itens, indiceAtual: 0 });
  }, []);

  const avancarOrganizacao = useCallback(() => {
    setOrganizacao((prev) => (prev ? { ...prev, indiceAtual: Math.min(prev.indiceAtual + 1, prev.itens.length - 1) } : prev));
  }, []);

  const voltarOrganizacao = useCallback(() => {
    setOrganizacao((prev) => (prev ? { ...prev, indiceAtual: Math.max(prev.indiceAtual - 1, 0) } : prev));
  }, []);

  const cancelarOrganizacao = useCallback(() => {
    setOrganizacao(null);
  }, []);

  const atualizarAgora = useCallback(() => {
    setAtualizando(true);
    setTimeout(() => {
      setUltimaAtualizacao(Date.now());
      setAtualizando(false);
    }, 600);
  }, []);

  return (
    <CentralDiaContext.Provider
      value={{
        concluidos,
        adiados,
        filtros,
        organizacao,
        toasts,
        ultimaAtualizacao,
        atualizando,
        avisar,
        marcarConcluido,
        desfazerConcluido,
        limparConcluidos,
        adiarItem,
        retomarItem,
        setFiltros,
        limparFiltros,
        iniciarOrganizacao,
        avancarOrganizacao,
        voltarOrganizacao,
        cancelarOrganizacao,
        atualizarAgora,
      }}
    >
      {children}
    </CentralDiaContext.Provider>
  );
}

export function useCentralDia() {
  const ctx = useContext(CentralDiaContext);
  if (!ctx) throw new Error("useCentralDia precisa estar dentro de CentralDiaProvider");
  return ctx;
}
