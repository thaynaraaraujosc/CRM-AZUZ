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

/** Chave estável de uma mensagem — usa `id` quando existe (toda mensagem que já veio ou já foi
 * sincronizada com o servidor tem um), senão cai num par texto+hora só pra não colidir tudo num
 * balde só (mensagem otimista sem id ainda, rarérrimo depois do primeiro render). */
function chaveMensagem(m: ConvMensagem, indice: number): string {
  return m.id ?? `${m.texto}-${m.hora}-${indice}`;
}

/**
 * Funde o que o servidor devolveu com o que já está na tela — nunca um `set` bruto. Um polling
 * (rodando em qualquer aba aberta, e você pode ter mais de uma) sempre reflete um instante do
 * passado; se ele chegou ANTES de uma mensagem que você acabou de mandar ter sido persistida, um
 * `set` bruto apagaria essa mensagem da tela (e, pior, o próximo PUT reconciliaria o servidor com
 * essa versão sem ela — apagando de vez). Fundir por id resolve os dois: o servidor manda quem
 * ganha em conteúdo/status quando os dois lados já concordam, e nada que só existe localmente
 * ainda (otimista, PUT em voo) é descartado.
 */
function fundirMensagensPorContato(
  local: Record<string, ConvMensagem[]>,
  doServidor: Record<string, ConvMensagem[]>,
): Record<string, ConvMensagem[]> {
  const contatos = new Set([...Object.keys(local), ...Object.keys(doServidor)]);
  const resultado: Record<string, ConvMensagem[]> = {};
  for (const contato of contatos) {
    const msgsServidor = doServidor[contato] ?? [];
    const msgsLocais = local[contato] ?? [];
    const chavesServidor = new Set(msgsServidor.map((m, i) => chaveMensagem(m, i)));
    const somenteLocais = msgsLocais.filter((m, i) => !chavesServidor.has(chaveMensagem(m, i)));
    resultado[contato] = [...msgsServidor, ...somenteLocais].sort(
      (a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0),
    );
  }
  return resultado;
}

export function MensagensExtraProvider({ children }: { children: ReactNode }) {
  const [mensagensExtraPorContato, setMensagensExtraPorContato] = useState<
    Record<string, ConvMensagem[]>
  >({});
  const carregadoRef = useRef(false);

  useEffect(() => {
    function buscar() {
      return fetch("/api/mensagens-extra")
        .then((r) => r.json())
        .then((dados: Record<string, ConvMensagem[]>) => {
          setMensagensExtraPorContato((prev) => fundirMensagensPorContato(prev, dados));
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
    const temporizador = setTimeout(() => {
      fetch("/api/mensagens-extra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mensagensExtraPorContato),
      }).catch((erro) => console.error("Falha ao sincronizar mensagens extras na API:", erro));
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
