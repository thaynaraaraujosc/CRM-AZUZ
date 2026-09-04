"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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
  arquivada: boolean;
  atendenteSelecionado: string | null;
  ehGrupo: boolean;
  participantesGrupo: { nome: string; telefone: string }[] | null;
  fotoUrl: string | null;
  descricaoGrupo: string | null;
  criacaoGrupo: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

type ConversasContextValue = {
  conversas: ConversaReal[];
  carregando: boolean;
  marcarComoLida: (id: string) => void;
  alternarFavorita: (id: string, favorita: boolean) => void;
  alternarArquivada: (id: string, arquivada: boolean) => void;
  atualizarStatus: (id: string, status: string) => void;
  atribuirAtendente: (id: string, atendente: string | null) => void;
  atualizarFoto: (id: string, fotoUrl: string) => void;
  criarConversaIndividual: (nome: string, contato: string, canal?: string) => Promise<ConversaReal>;
  /** Força buscar as conversas de novo agora, sem esperar o próximo ciclo do polling — usado pelo
   * botão de atualizar da tela de Conversas. */
  recarregar: () => void;
  /** Apaga a conversa e as mensagens dela — usado pra limpar uma conversa avulsa (ex.: mensagem de
   * grupo que nasceu como conversa solta antes de existir a correção do sincronizador). */
  excluirConversa: (id: string) => void;
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
/**
 * A foto de perfil é salva com um PATCH imediato (sem debounce) — mas o polling de 5s pode chegar
 * ANTES desse PATCH terminar de persistir, trazendo o servidor ainda com `fotoUrl: null` e apagando
 * a foto que acabou de aparecer na tela (o bug do "aparece e some" relatado). Preserva a foto local
 * quando o servidor ainda não tem uma.
 */
function mesclarConversas(local: ConversaReal[], doServidor: ConversaReal[]): ConversaReal[] {
  const mapaLocal = new Map(local.map((c) => [c.id, c]));
  return doServidor.map((c) => {
    const anterior = mapaLocal.get(c.id);
    if (anterior?.fotoUrl && !c.fotoUrl) return { ...c, fotoUrl: anterior.fotoUrl };
    return c;
  });
}

export function ConversasProvider({ children }: { children: ReactNode }) {
  const [conversas, setConversas] = useState<ConversaReal[]>([]);
  const [carregando, setCarregando] = useState(true);

  /** Mesma ideia da rota de mensagens: manda de volta a versão que o servidor já confirmou e
   * recebe `304` quando nada mudou, sem o servidor ler a lista inteira. */
  const etagRef = useRef<string | null>(null);

  function recarregar() {
    return fetch("/api/conversas", {
      cache: "no-store",
      headers: etagRef.current ? { "if-none-match": etagRef.current } : undefined,
    })
      .then(async (r) => {
        if (r.status === 304) return;
        const etag = r.headers.get("etag");
        if (etag) etagRef.current = etag;
        const dados = (await r.json()) as ConversaReal[];
        setConversas((prev) => mesclarConversas(prev, dados));
      })
      .catch((erro) => console.error("Falha ao carregar conversas da API:", erro));
  }

  /** Toda escrita (PATCH de favorita, lida, foto…) deixa a versão guardada velha — descartar aqui
   * garante que a próxima batida traga o estado real em vez de um `304` enganoso. */
  function esquecerVersao() {
    etagRef.current = null;
  }

  useEffect(() => {
    recarregar().finally(() => setCarregando(false));

    // Polling — mensagem nova (do webhook do WhatsApp/Instagram) precisa aparecer sozinha, sem
    // depender de recarregar a página, igual todo app de mensagem de verdade. Só busca quando a
    // aba está visível, pra não gastar requisição à toa com o CRM aberto em segundo plano.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 5000);
    return () => clearInterval(intervalo);
  }, []);

  function marcarComoLida(id: string) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)));
    esquecerVersao();
    atualizarRemoto(id, { naoLidas: 0 });
  }

  function alternarFavorita(id: string, favorita: boolean) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, favorita } : c)));
    esquecerVersao();
    atualizarRemoto(id, { favorita });
  }

  function alternarArquivada(id: string, arquivada: boolean) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, arquivada } : c)));
    esquecerVersao();
    atualizarRemoto(id, { arquivada });
  }

  function atualizarStatus(id: string, status: string) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    esquecerVersao();
    atualizarRemoto(id, { status });
  }

  function atribuirAtendente(id: string, atendente: string | null) {
    setConversas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, atendenteSelecionado: atendente } : c)),
    );
    esquecerVersao();
    atualizarRemoto(id, { atendenteSelecionado: atendente });
  }

  // Preenchida sob demanda pela tela (ver `conversas/page.tsx`) quando a conversa é aberta e ainda
  // não tem foto salva — não passa pelo otimista+PATCH normal porque não é uma ação do usuário, é
  // só "guardar o que a Evolution devolveu" pra não ter que buscar de novo na próxima vez.
  function atualizarFoto(id: string, fotoUrl: string) {
    setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, fotoUrl } : c)));
    esquecerVersao();
    atualizarRemoto(id, { fotoUrl });
  }

  // Usado quando a usuária quer ser a PRIMEIRA a escrever pra alguém sem conversa ainda (ex.: um
  // participante de grupo visto só de longe) — cria de verdade no banco (não é otimista, precisa do
  // `id` real devolvido antes de poder navegar pra ela).
  async function criarConversaIndividual(
    nome: string,
    contato: string,
    canal = "WhatsApp",
  ): Promise<ConversaReal> {
    esquecerVersao();
    const resposta = await fetch("/api/conversas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, contato, canal }),
    });
    const criada = (await resposta.json()) as ConversaReal;
    setConversas((prev) => (prev.some((c) => c.id === criada.id) ? prev : [criada, ...prev]));
    return criada;
  }

  function excluirConversa(id: string) {
    esquecerVersao();
    setConversas((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/conversas/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir conversa na API:", erro),
    );
  }

  return (
    <ConversasContext.Provider
      value={{
        conversas,
        carregando,
        marcarComoLida,
        alternarFavorita,
        alternarArquivada,
        atualizarStatus,
        atribuirAtendente,
        atualizarFoto,
        criarConversaIndividual,
        recarregar,
        excluirConversa,
      }}
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
