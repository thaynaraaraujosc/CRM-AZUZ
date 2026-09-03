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

import type { Funil, NegocioCard } from "@/lib/data";

type FunisContextValue = {
  funis: Funil[];
  setFunis: Dispatch<SetStateAction<Funil[]>>;
  funilAtivoId: string;
  setFunilAtivoId: (id: string) => void;
  /**
   * Move (ou cria) o card desse contato pra etapa escolhida, dentro do funil
   * escolhido — tira o card de onde ele estivesse antes, em qualquer funil,
   * pra nunca ficar duplicado.
   */
  atribuirContatoAoFunil: (
    funilId: string,
    etapaTitulo: string,
    contato: Omit<NegocioCard, "id"> & { id?: string },
  ) => void;
  /** Não deixa apagar o último funil que sobrou — sempre precisa ter pelo menos um. */
  excluirFunil: (funilId: string) => void;
  /**
   * Move UM negócio de etapa/funil e, opcionalmente, troca o responsável — gravado na hora.
   *
   * Devolve `{ ok }`. Quando dá errado, a tela volta ao que está no banco em vez de continuar
   * mostrando uma mudança que não aconteceu.
   */
  moverNegocio: (params: {
    cardId: string;
    etapaId: string;
    responsavel?: string | null;
  }) => Promise<{ ok: boolean; erro?: string }>;
  /** Cria um funil gravando no banco antes de aparecer na tela. */
  criarFunilPersistido: (funil: Funil) => Promise<{ ok: boolean; erro?: string }>;
  /** Cria uma etapa gravando no banco antes de aparecer na tela. */
  criarEtapaPersistida: (funilId: string, etapa: { id: string; titulo: string }) => Promise<{ ok: boolean; erro?: string }>;
  /** Último erro de gravação, pra tela avisar em vez de fingir que salvou. */
  erroSincronizacao: string | null;
  limparErroSincronizacao: () => void;
};

const FunisContext = createContext<FunisContextValue | null>(null);

/**
 * Funis vivem num contexto no topo do app (não em cada página) porque uma
 * edição feita em /funil (renomear/criar/apagar etapa, criar funil novo)
 * precisa aparecer também em "Atribuir ao funil" no WhatsApp, sem as duas
 * telas ficarem com cópias dessincronizadas dos dados.
 */
export function FunisProvider({ children }: { children: ReactNode }) {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [funilAtivoId, setFunilAtivoId] = useState("");
  /** Último erro de gravação — a tela mostra pra ninguém achar que salvou quando não salvou. */
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(null);
  const carregadoRef = useRef(false);
  /**
   * Marca que o próximo `funis` novo veio do BANCO, não de uma edição — então não deve ser
   * gravado de volta.
   *
   * Sem isto havia um laço fechado: o PUT falhava, o `.then` recarregava do banco, o
   * `setFunis` da recarga disparava o efeito de sincronização, que mandava outro PUT, que
   * falhava de novo. O console enchia com o mesmo 500 repetido pra sempre e cada volta
   * segurava mais uma das 3 conexões do pool — o erro se alimentava sozinho e ia piorando.
   */
  const vindoDoServidorRef = useRef(false);

  useEffect(() => {
    fetch("/api/funis")
      .then((r) => r.json())
      .then((dados: Funil[]) => {
        setFunis(dados);
        setFunilAtivoId((atual) => atual || dados[0]?.id || "");
        carregadoRef.current = true;
      })
      .catch((erro) => console.error("Falha ao carregar funis da API:", erro));
  }, []);

  // Não existem mutadores dedicados pra Funil (~13 pontos em funil/page.tsx/FunisSecao.tsx mexem
  // direto em setFunis) — por isso sincroniza o estado inteiro com o banco a cada mudança, em vez de
  // granular por operação (mesmo espírito do antigo useEffect que gravava tudo no localStorage).
  // Debounça 500ms pra não disparar um PUT a cada pixel de um drag de card/coluna.
  const pendenteRef = useRef<Funil[] | null>(null);

  function persistirFunis(dados: Funil[]) {
    pendenteRef.current = null;
    fetch("/api/funis", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      keepalive: true,
    })
      .then(async (resposta) => {
        // O `.catch` sozinho NÃO pega isto: um HTTP 500 resolve a promessa normalmente. Sem
        // conferir `ok`, uma gravação recusada pelo banco era invisível — a tela mostrava o funil
        // novo, o banco não tinha nada, e no F5 ele "sumia" sem nenhum erro em lugar nenhum. Era a
        // causa do bug de funil e etapa desaparecendo.
        if (resposta.ok) return;
        const dadosErro = (await resposta.json().catch(() => ({}))) as { erro?: string };
        console.error("Funis não foram salvos:", dadosErro.erro ?? resposta.status);
        setErroSincronizacao(
          dadosErro.erro ?? "As alterações do funil não foram salvas. Recarregando do servidor…",
        );
        // Recarrega do banco: melhor a tela voltar ao que está gravado do que seguir mostrando uma
        // versão que não existe. Front e banco nunca ficam divergentes em silêncio.
        await recarregar();
      })
      .catch((erro) => console.error("Falha ao sincronizar funis na API:", erro));
  }

  /** Relê os funis do banco — usado depois de uma gravação recusada e depois de cada operação
   * imediata, pra tela e banco contarem a mesma história. */
  async function recarregar() {
    const dados = (await fetch("/api/funis").then((r) => r.json())) as Funil[];
    vindoDoServidorRef.current = true;
    setFunis(dados);
    return dados;
  }

  useEffect(() => {
    if (!carregadoRef.current) return;
    // Estado que acabou de ser lido do banco não precisa voltar pra ele — e devolvê-lo depois de
    // uma gravação recusada era o que criava o laço infinito de PUTs (ver `vindoDoServidorRef`).
    if (vindoDoServidorRef.current) {
      vindoDoServidorRef.current = false;
      pendenteRef.current = null;
      return;
    }
    pendenteRef.current = funis;
    const temporizador = setTimeout(() => persistirFunis(funis), 500);
    return () => clearTimeout(temporizador);
  }, [funis]);

  // Um F5/fechar aba logo após arrastar um card cancela o setTimeout acima antes dele disparar
  // (a navegação mata o JS antes dos 500ms) — sem isso, a mudança nunca chega a ser salva e o
  // usuário vê o funil "voltar" pro estado anterior ao recarregar. `keepalive` garante que o PUT
  // sobrevive à navegação em vez de ser abortado junto com a página.
  useEffect(() => {
    function flush() {
      if (pendenteRef.current) persistirFunis(pendenteRef.current);
    }
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  /**
   * Grava a movimentação imediatamente e só então mexe na tela.
   *
   * O contrário do que existia: o card se movia primeiro e a gravação vinha meio segundo depois,
   * dentro de uma reconciliação do funil inteiro. Se ela falhasse — e falhava em silêncio — o card
   * aparecia na etapa nova e voltava pra antiga no próximo F5.
   */
  async function moverNegocio({
    cardId,
    etapaId,
    responsavel,
  }: {
    cardId: string;
    etapaId: string;
    responsavel?: string | null;
  }): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await fetch("/api/funis/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, etapaId, responsavel }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErroSincronizacao(dados.erro ?? "Não foi possível mover o negócio.");
        await recarregar();
        return { ok: false, erro: dados.erro };
      }
      // Relê do banco: é a única forma de a tela refletir exatamente o que ficou gravado,
      // inclusive contadores e a posição final dentro da coluna.
      await recarregar();
      return { ok: true };
    } catch {
      setErroSincronizacao("Falha de conexão ao mover o negócio.");
      await recarregar();
      return { ok: false, erro: "Falha de conexão." };
    }
  }

  async function criarFunilPersistido(funil: Funil): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await fetch("/api/funis/estrutura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "funil",
          id: funil.id,
          nome: funil.nome,
          responsavel: funil.responsavel ?? null,
          etapas: funil.colunas.map((c) => ({ id: c.id, titulo: c.titulo })),
        }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErroSincronizacao(dados.erro ?? "Não foi possível criar o funil.");
        return { ok: false, erro: dados.erro };
      }
      // Só entra na tela DEPOIS de existir no banco — nunca mais um funil que some no F5.
      setFunis((prev) => [...prev, funil]);
      return { ok: true };
    } catch {
      setErroSincronizacao("Falha de conexão ao criar o funil.");
      return { ok: false, erro: "Falha de conexão." };
    }
  }

  async function criarEtapaPersistida(
    funilId: string,
    etapa: { id: string; titulo: string },
  ): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await fetch("/api/funis/estrutura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "etapa", id: etapa.id, nome: etapa.titulo, funilId }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErroSincronizacao(dados.erro ?? "Não foi possível criar a etapa.");
        return { ok: false, erro: dados.erro };
      }
      setFunis((prev) =>
        prev.map((f) =>
          f.id === funilId
            ? { ...f, colunas: [...f.colunas, { id: etapa.id, titulo: etapa.titulo, total: 0, cards: [] }] }
            : f,
        ),
      );
      return { ok: true };
    } catch {
      setErroSincronizacao("Falha de conexão ao criar a etapa.");
      return { ok: false, erro: "Falha de conexão." };
    }
  }

  function atribuirContatoAoFunil(
    funilId: string,
    etapaTitulo: string,
    contato: Omit<NegocioCard, "id"> & { id?: string },
  ) {
    setFunis((prev) => {
      // tira o card desse contato de onde ele estiver, em qualquer funil
      const semDuplicata = prev.map((f) => ({
        ...f,
        colunas: f.colunas.map((c) => {
          const cards = c.cards.filter((card) => card.nome !== contato.nome);
          return cards.length === c.cards.length
            ? c
            : { ...c, cards, total: Math.max(0, c.total - 1) };
        }),
      }));

      const novoCard: NegocioCard = {
        id: contato.id ?? `negocio-${Date.now()}`,
        nome: contato.nome,
        valor: contato.valor,
        origem: contato.origem,
        dias: contato.dias,
        data: contato.data,
        responsavel: contato.responsavel,
      };

      return semDuplicata.map((f) => {
        if (f.id !== funilId) return f;
        let etapaEncontrada = false;
        const colunas = f.colunas.map((c) => {
          if (c.titulo !== etapaTitulo) return c;
          etapaEncontrada = true;
          return { ...c, cards: [...c.cards, novoCard], total: c.total + 1 };
        });
        if (!etapaEncontrada) return f;
        return { ...f, colunas };
      });
    });

    // Card que JÁ existe é movido na hora, pela mesma rota do arrastar e da janela de transferir.
    // Sem isto, este caminho (usado pelas Conversas) dependia do sync do funil inteiro — o mesmo
    // que falhava em silêncio — e o lead voltava pra etapa antiga no F5. Os três caminhos precisam
    // terminar no mesmo lugar do banco.
    //
    // Card NOVO continua nascendo pelo sync geral: ele ainda não existe pra ser movido.
    if (contato.id) {
      const etapaDestino = funis
        .find((f) => f.id === funilId)
        ?.colunas.find((c) => c.titulo === etapaTitulo);
      if (etapaDestino) {
        void moverNegocio({ cardId: contato.id, etapaId: etapaDestino.id });
      }
    }
  }

  function excluirFunil(funilId: string) {
    setFunis((prev) => {
      if (prev.length <= 1) return prev;
      const restante = prev.filter((f) => f.id !== funilId);
      if (funilId === funilAtivoId && restante[0]) {
        setFunilAtivoId(restante[0].id);
      }
      return restante;
    });
  }

  return (
    <FunisContext.Provider
      value={{
        funis,
        setFunis,
        funilAtivoId,
        setFunilAtivoId,
        atribuirContatoAoFunil,
        excluirFunil,
        moverNegocio,
        criarFunilPersistido,
        criarEtapaPersistida,
        erroSincronizacao,
        limparErroSincronizacao: () => setErroSincronizacao(null),
      }}
    >
      {children}
    </FunisContext.Provider>
  );
}

export function useFunis() {
  const ctx = useContext(FunisContext);
  if (!ctx) throw new Error("useFunis precisa estar dentro de FunisProvider");
  return ctx;
}
