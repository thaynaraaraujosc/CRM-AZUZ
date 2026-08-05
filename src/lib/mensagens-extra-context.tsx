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

import type { ConvMensagem } from "@/lib/data";

/**
 * Mensagens extras (enviadas/recebidas depois do "seed" de cada conversa) — compartilhado entre
 * WhatsApp (`/conversas`) e o popup de resposta rápida do Funil, porque as duas telas conversam
 * com o MESMO contato: uma mensagem mandada de um lugar precisa aparecer no outro. Mesma chave de
 * localStorage que a tela de conversas já usava sozinha antes — nenhum histórico existente se
 * perde ao migrar pra esse Provider compartilhado.
 */
export const MENSAGENS_EXTRA_STORAGE_KEY = "azuz-crm-conversas-mensagens";

type MensagensExtraContextValue = {
  mensagensExtraPorContato: Record<string, ConvMensagem[]>;
  setMensagensExtraPorContato: Dispatch<SetStateAction<Record<string, ConvMensagem[]>>>;
};

const MensagensExtraContext = createContext<MensagensExtraContextValue | null>(null);

export function MensagensExtraProvider({ children }: { children: ReactNode }) {
  const [mensagensExtraPorContato, setMensagensExtraPorContato] = useState<
    Record<string, ConvMensagem[]>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const salvo = localStorage.getItem(MENSAGENS_EXTRA_STORAGE_KEY);
      return salvo ? (JSON.parse(salvo) as Record<string, ConvMensagem[]>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MENSAGENS_EXTRA_STORAGE_KEY, JSON.stringify(mensagensExtraPorContato));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) ou anexo grande demais pra caber na
      // cota — a conversa segue funcionando só em memória.
    }
  }, [mensagensExtraPorContato]);

  // Duas abas abertas (ex.: Funil numa, WhatsApp na outra) precisam ver a mensagem uma da outra
  // sem precisar recarregar — mesmo padrão já usado em contatos-context/funis-context.
  useEffect(() => {
    function aoMudarStorage(e: StorageEvent) {
      if (e.key !== MENSAGENS_EXTRA_STORAGE_KEY || !e.newValue) return;
      try {
        setMensagensExtraPorContato(JSON.parse(e.newValue) as Record<string, ConvMensagem[]>);
      } catch {
        // payload inválido — ignora.
      }
    }
    window.addEventListener("storage", aoMudarStorage);
    return () => window.removeEventListener("storage", aoMudarStorage);
  }, []);

  return (
    <MensagensExtraContext.Provider value={{ mensagensExtraPorContato, setMensagensExtraPorContato }}>
      {children}
    </MensagensExtraContext.Provider>
  );
}

export function useMensagensExtra() {
  const ctx = useContext(MensagensExtraContext);
  if (!ctx) throw new Error("useMensagensExtra precisa estar dentro de MensagensExtraProvider");
  return ctx;
}
