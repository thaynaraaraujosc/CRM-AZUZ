"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ConversaReal = {
  id: string;
  workspaceId: string;
  contatoId: string | null;
  nome: string;
  initials: string;
  canal: string;
  contato: string | null;
  origem: string;
  status: string;
  naoLidas: number;
  favorita: boolean;
  atendenteSelecionado: string | null;
  ehGrupo: boolean;
  participantesGrupo: { nome: string; telefone: string }[] | null;
  criadoEm: string;
  atualizadoEm: string;
};

type ConversasContextValue = {
  conversas: ConversaReal[];
  carregando: boolean;
  marcarComoLida: (id: string) => void;
  alternarFavorita: (id: string, favorita: boolean) => void;
  atualizarStatus: (id: string, status: string) => void;
  atribuirAtendente: (id: string, atendente: string | null) => void;
};

const ConversasContext = createContext<ConversasContextValue | null>(null);

function atualizarRemoto(id: string, dados: Record<string, unknown>) {
  fetch(`/api/conversas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  }).catch((erro) => console.error("Falha ao atualizar conversa na API:", erro));
}

/**
 * Conversas de verdade (ver `prisma/schema.prisma` model `Conversa`) — nascem sozinhas quando chega
 * a primeira mensagem por um webhook conectado (`src/lib/conversas/upsert.ts`), sem nenhum dado de
 * exemplo/mock aqui. Mesmo espírito de `contatos-context.tsx`: estado local otimista + fetch no
 * mount + mutações que atualizam o estado na hora e disparam a chamada real em paralelo.
 */
export function ConversasProvider({ children }: { children: ReactNode }) {
  const [conversas, setConversas] = useState<ConversaReal[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    function buscar() {
      return fetch("/api/conversas")
        .then((r) => r.json())
        .then((dados: ConversaReal[]) => setConversas(dados))
        .catch((erro) => console.error("Falha ao carregar conversas da API:", erro));
    }
    buscar().finally(() => setCarregando(false));

    // Polling — mensagem nova (do webhook do WhatsApp/Instagram) precisa aparecer sozinha, sem
    // depender de recarregar a página, igual todo app de mensagem de verdade. Só busca quando a
    // aba está visível, pra não gastar requisição à toa com o CRM aberto em segundo plano.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") buscar();
    }, 5000);
    return () => clearInterval(intervalo);
  }, []);

  function marcarComoLida(id: string) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)));
    atualizarRemoto(id, { naoLidas: 0 });
  }

  function alternarFavorita(id: string, favorita: boolean) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, favorita } : c)));
    atualizarRemoto(id, { favorita });
  }

  function atualizarStatus(id: string, status: string) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    atualizarRemoto(id, { status });
  }

  function atribuirAtendente(id: string, atendente: string | null) {
    setConversas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, atendenteSelecionado: atendente } : c)),
    );
    atualizarRemoto(id, { atendenteSelecionado: atendente });
  }

  return (
    <ConversasContext.Provider
      value={{ conversas, carregando, marcarComoLida, alternarFavorita, atualizarStatus, atribuirAtendente }}
    >
      {children}
    </ConversasContext.Provider>
  );
}

export function useConversas() {
  const ctx = useContext(ConversasContext);
  if (!ctx) throw new Error("useConversas precisa estar dentro de ConversasProvider");
  return ctx;
}
