"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { ConvMensagem } from "@/lib/data";

/**
 * Mensagens extras (enviadas/recebidas depois do "seed" de cada conversa) — compartilhado entre
 * WhatsApp (`/conversas`) e o popup de resposta rápida do Funil, porque as duas telas conversam
 * com o MESMO contato: uma mensagem mandada de um lugar precisa aparecer no outro.
 *
 * Banco real (ver src/app/api/mensagens-extra/) — não tem mutador dedicado aqui (só 4 chamadas
 * cruas de `setMensagensExtraPorContato` em `funil/page.tsx`/`conversas/page.tsx`), então sincroniza
 * o Record inteiro com a API a cada mudança, mesmo molde de `funis-context.tsx`. Resolve de graça o
 * bug que já existia aqui: anexo grande estourava a cota do localStorage.
 */
type MensagensExtraContextValue = {
  mensagensExtraPorContato: Record<string, ConvMensagem[]>;
  setMensagensExtraPorContato: Dispatch<SetStateAction<Record<string, ConvMensagem[]>>>;
};

const MensagensExtraContext = createContext<MensagensExtraContextValue | null>(null);

export function MensagensExtraProvider({ children }: { children: ReactNode }) {
  const [mensagensExtraPorContato, setMensagensExtraPorContato] = useState<
    Record<string, ConvMensagem[]>
  >({});
  const carregadoRef = useRef(false);
  // Enquanto uma escrita local (PUT debounced) está pendente/em voo, o polling não pode buscar e
  // sobrescrever o estado — senão uma mensagem que você acabou de digitar pode sumir da tela por
  // uma fração de segundo até o PUT terminar. Fica marcado true do momento que o texto muda até o
  // PUT completar.
  const escritaPendenteRef = useRef(false);

  useEffect(() => {
    function buscar() {
      return fetch("/api/mensagens-extra")
        .then((r) => r.json())
        .then((dados: Record<string, ConvMensagem[]>) => {
          if (escritaPendenteRef.current) return;
          setMensagensExtraPorContato(dados);
        })
        .catch((erro) => console.error("Falha ao carregar mensagens extras da API:", erro));
    }
    buscar().finally(() => {
      carregadoRef.current = true;
    });

    // Polling — mensagem nova (do webhook do WhatsApp/Instagram) precisa aparecer sozinha, sem
    // depender de recarregar a página, igual todo app de mensagem de verdade.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") buscar();
    }, 5000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!carregadoRef.current) return;
    escritaPendenteRef.current = true;
    const temporizador = setTimeout(() => {
      fetch("/api/mensagens-extra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mensagensExtraPorContato),
      })
        .catch((erro) => console.error("Falha ao sincronizar mensagens extras na API:", erro))
        .finally(() => {
          escritaPendenteRef.current = false;
        });
    }, 400);
    return () => clearTimeout(temporizador);
  }, [mensagensExtraPorContato]);

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
