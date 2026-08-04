"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { contatos as contatosIniciais, type Contato } from "@/lib/data";
import { slugId } from "@/lib/ids";

type DadosContato = Omit<Contato, "initials" | "nome" | "origem" | "etapa" | "responsavel">;

type ContatosContextValue = {
  contatos: Contato[];
  setContatos: Dispatch<SetStateAction<Contato[]>>;
  /**
   * Cria o contato se ainda não existir (ex.: alguém que só existe no WhatsApp), ou atualiza os dados dele.
   * Aceita qualquer campo extra (ex.: `etiquetas`, `camposPersonalizados`) além dos campos tipados de
   * `DadosContato` — é o que o motor de automação usa via `Ligacoes.salvarContato` pra gravar mudanças
   * de etiqueta/campo que não têm uma coluna dedicada em `Contato`.
   */
  salvarDadosContato: (nome: string, dados: Partial<DadosContato> & Record<string, unknown>) => void;
  /** Atribui o atendente responsável por esse contato (cria o contato se for a primeira vez que ele aparece). */
  atribuirAtendente: (nome: string, atendente: string) => void;
  criarContato: (dados: Partial<DadosContato> & { nome: string }) => Contato;
  adicionarEtiqueta: (nome: string, etiqueta: string) => void;
  removerEtiqueta: (nome: string, etiqueta: string) => void;
  alternarFavorito: (nome: string) => void;
};

const ContatosContext = createContext<ContatosContextValue | null>(null);

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Piloto de migração pro banco real (MySQL/Railway via Prisma, ver `src/app/api/contatos/`) — o
 * contrato público do Provider continua o mesmo de antes (mesmas funções, mesmas assinaturas), só o
 * motor por dentro mudou: em vez de `localStorage`, busca da API no mount e cada mutação atualiza o
 * estado local otimisticamente E dispara a chamada real pra API, sem bloquear a UI. Falha de rede só
 * loga no console nesta fase — sem toast de erro ainda (fica pra quando o padrão se expandir pros
 * outros módulos).
 */
export function ContatosProvider({ children }: { children: ReactNode }) {
  const [contatos, setContatos] = useState<Contato[]>([...contatosIniciais]);

  useEffect(() => {
    fetch("/api/contatos")
      .then((r) => r.json())
      .then((dados: Contato[]) => setContatos(dados))
      .catch((erro) => console.error("Falha ao carregar contatos da API:", erro));
  }, []);

  function upsertRemoto(nome: string, dados: Partial<Contato> & Record<string, unknown>) {
    fetch("/api/contatos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, dados }),
    }).catch((erro) => console.error("Falha ao salvar contato na API:", erro));
  }

  function atualizarRemoto(id: string, dados: Partial<Contato> & Record<string, unknown>) {
    fetch(`/api/contatos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).catch((erro) => console.error("Falha ao atualizar contato na API:", erro));
  }

  function salvarDadosContato(nome: string, dados: Partial<DadosContato> & Record<string, unknown>) {
    setContatos((prev) => {
      const existe = prev.some((c) => c.nome === nome);
      if (!existe) {
        return [
          ...prev,
          {
            id: slugId(nome),
            initials: iniciais(nome),
            nome,
            origem: "Indicação",
            etapa: "Novo",
            responsavel: "—",
            ultima: "Agora",
            valor: "—",
            ...dados,
          },
        ];
      }
      return prev.map((c) => (c.nome === nome ? { ...c, ...dados } : c));
    });
    upsertRemoto(nome, dados);
  }

  function atribuirAtendente(nome: string, atendente: string) {
    setContatos((prev) => {
      const existe = prev.some((c) => c.nome === nome);
      if (!existe) {
        return [
          ...prev,
          {
            id: slugId(nome),
            initials: iniciais(nome),
            nome,
            origem: "Indicação" as const,
            etapa: "Novo" as const,
            responsavel: atendente,
            ultima: "Agora",
            valor: "—",
          },
        ];
      }
      return prev.map((c) =>
        c.nome === nome ? { ...c, responsavel: atendente } : c,
      );
    });
    upsertRemoto(nome, { responsavel: atendente });
  }

  function criarContato(dados: Partial<DadosContato> & { nome: string }) {
    const novo: Contato = {
      id: slugId(dados.nome),
      initials: iniciais(dados.nome),
      origem: "Indicação",
      etapa: "Novo",
      responsavel: "—",
      ultima: "Agora",
      valor: "—",
      ...dados,
    };
    setContatos((prev) => [...prev, novo]);
    upsertRemoto(dados.nome, dados);
    return novo;
  }

  function adicionarEtiqueta(nome: string, etiqueta: string) {
    let idAlvo: string | undefined;
    let etiquetasFinais: string[] = [];
    setContatos((prev) =>
      prev.map((c) => {
        if (c.nome !== nome || (c.etiquetas ?? []).includes(etiqueta)) return c;
        idAlvo = c.id;
        etiquetasFinais = [...(c.etiquetas ?? []), etiqueta];
        return { ...c, etiquetas: etiquetasFinais };
      }),
    );
    if (idAlvo) atualizarRemoto(idAlvo, { etiquetas: etiquetasFinais });
  }

  function removerEtiqueta(nome: string, etiqueta: string) {
    let idAlvo: string | undefined;
    let etiquetasFinais: string[] = [];
    setContatos((prev) =>
      prev.map((c) => {
        if (c.nome !== nome) return c;
        idAlvo = c.id;
        etiquetasFinais = (c.etiquetas ?? []).filter((e) => e !== etiqueta);
        return { ...c, etiquetas: etiquetasFinais };
      }),
    );
    if (idAlvo) atualizarRemoto(idAlvo, { etiquetas: etiquetasFinais });
  }

  function alternarFavorito(nome: string) {
    let idAlvo: string | undefined;
    let favoritoFinal = false;
    setContatos((prev) =>
      prev.map((c) => {
        if (c.nome !== nome) return c;
        idAlvo = c.id;
        favoritoFinal = !c.favorito;
        return { ...c, favorito: favoritoFinal };
      }),
    );
    if (idAlvo) atualizarRemoto(idAlvo, { favorito: favoritoFinal });
  }

  return (
    <ContatosContext.Provider
      value={{
        contatos,
        setContatos,
        salvarDadosContato,
        atribuirAtendente,
        criarContato,
        adicionarEtiqueta,
        removerEtiqueta,
        alternarFavorito,
      }}
    >
      {children}
    </ContatosContext.Provider>
  );
}

export function useContatos() {
  const ctx = useContext(ContatosContext);
  if (!ctx) throw new Error("useContatos precisa estar dentro de ContatosProvider");
  return ctx;
}
