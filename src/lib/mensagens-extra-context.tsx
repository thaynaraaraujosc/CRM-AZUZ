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
import { INTERVALO_POLLING_MS } from "@/lib/conversas/polling";

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
  /** Força buscar as mensagens de novo agora, sem esperar o próximo ciclo do polling — usado pelo
   * botão de atualizar da tela de Conversas. */
  recarregar: () => void;
};

const MensagensExtraContext = createContext<MensagensExtraContextValue | null>(null);

/** Chave estável de uma mensagem — usa `id` quando existe (toda mensagem que já veio ou já foi
 * sincronizada com o servidor tem um), senão cai num par texto+hora só pra não colidir tudo num
 * balde só (mensagem otimista sem id ainda, rarérrimo depois do primeiro render). */
function chaveMensagem(m: ConvMensagem, indice: number): string {
  return m.id ?? `${m.texto}-${m.hora}-${indice}`;
}

/** Chave estável e globalmente única de uma mensagem — usada pra achar o que mudou entre dois
 * estados (ver `calcularDelta`) e como `id` de fallback no upsert do servidor. */
function chaveGlobal(contato: string, m: ConvMensagem, indice: number): string {
  return m.id ?? `${contato}::${indice}`;
}

/**
 * Compara o estado atual com o último estado que já se sabe estar refletido no servidor (depois
 * de um GET ou de um PUT bem-sucedido) e devolve só o que precisa ser enviado — nunca a tabela
 * inteira. Isso é o que evita reprocessar/retransmitir todo o histórico do workspace a cada
 * mudança de estado (inclusive as que vêm do próprio polling), que era a causa raiz do
 * travamento em `/conversas`.
 */
function calcularDelta(
  anterior: Record<string, ConvMensagem[]>,
  atual: Record<string, ConvMensagem[]>,
): { upserts: { contato: string; idFinal: string; mensagem: ConvMensagem }[]; deletarIds: string[] } {
  const mapaAnterior = new Map<string, { contato: string; mensagem: ConvMensagem }>();
  for (const [contato, mensagens] of Object.entries(anterior)) {
    mensagens.forEach((m, i) => mapaAnterior.set(chaveGlobal(contato, m, i), { contato, mensagem: m }));
  }

  const upserts: { contato: string; idFinal: string; mensagem: ConvMensagem }[] = [];
  const chavesAtuais = new Set<string>();
  for (const [contato, mensagens] of Object.entries(atual)) {
    mensagens.forEach((m, i) => {
      const chave = chaveGlobal(contato, m, i);
      chavesAtuais.add(chave);
      const antiga = mapaAnterior.get(chave);
      if (!antiga || JSON.stringify(antiga.mensagem) !== JSON.stringify(m)) {
        upserts.push({ contato, idFinal: chave, mensagem: m });
      }
    });
  }

  const deletarIds: string[] = [];
  for (const [chave, { mensagem }] of mapaAnterior) {
    if (!chavesAtuais.has(chave)) deletarIds.push(mensagem.id ?? chave);
  }

  return { upserts, deletarIds };
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
/**
 * Uma mídia pendente (áudio/imagem recebida sem conteúdo no webhook) é resolvida localmente sob
 * demanda — o PUT que persiste isso no servidor é debounçado (400ms) e só reflete no GET depois.
 * Sem isso, o polling de 5s pega o servidor ainda com o placeholder antigo e sobrescreve o áudio/
 * imagem já carregado na tela, fazendo ele "aparecer e sumir" e disparando um novo fetch à toa.
 */
function mesclarMensagem(doServidor: ConvMensagem, local: ConvMensagem): ConvMensagem {
  if (local.midiaPendente === undefined && doServidor.midiaPendente) {
    return {
      ...doServidor,
      midiaPendente: undefined,
      audio: local.audio ?? doServidor.audio,
      imagens: local.imagens ?? doServidor.imagens,
    };
  }
  return doServidor;
}

function fundirMensagensPorContato(
  local: Record<string, ConvMensagem[]>,
  doServidor: Record<string, ConvMensagem[]>,
): Record<string, ConvMensagem[]> {
  const contatos = new Set([...Object.keys(local), ...Object.keys(doServidor)]);
  const resultado: Record<string, ConvMensagem[]> = {};
  for (const contato of contatos) {
    const msgsServidor = doServidor[contato] ?? [];
    const msgsLocais = local[contato] ?? [];
    const mapaLocal = new Map(msgsLocais.map((m, i) => [chaveMensagem(m, i), m]));
    const chavesServidor = new Set(msgsServidor.map((m, i) => chaveMensagem(m, i)));
    const somenteLocais = msgsLocais.filter((m, i) => !chavesServidor.has(chaveMensagem(m, i)));
    const mescladas = msgsServidor.map((m, i) => {
      const chave = chaveMensagem(m, i);
      const localCorrespondente = mapaLocal.get(chave);
      return localCorrespondente ? mesclarMensagem(m, localCorrespondente) : m;
    });
    resultado[contato] = [...mescladas, ...somenteLocais].sort(
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
  // Último estado que já se sabe estar refletido no servidor — a base pra calcular o delta do
  // próximo PUT. Atualizado depois de todo GET/PUT bem-sucedido, nunca durante o merge otimista.
  const ultimoSincronizadoRef = useRef<Record<string, ConvMensagem[]>>({});

  /**
   * Versão que o servidor já confirmou — mandada de volta em `If-None-Match` na próxima batida.
   * Quando nada mudou, a resposta é um `304` sem corpo: o servidor nem chega a consultar as
   * mensagens. Ver `src/lib/conversas/assinatura.ts`; era esta chamada, repetida a cada 5s por aba
   * aberta, que sozinha puxava ~1,9 TB do banco por mês.
   */
  const etagRef = useRef<string | null>(null);
  /**
   * Sincronização incremental (ver `GET /api/mensagens-extra`). `marca` é o instante até o qual
   * esta tela está em dia; a próxima batida pede só o que mudou depois dele. `total` é quantas
   * mensagens o servidor disse ter na última resposta: apagamento não aparece num delta, então é
   * comparando o total que se descobre que algo sumiu — e aí se pede a lista inteira uma vez.
   *
   * O que isto muda na conta: antes, cada mensagem nova fazia a tela baixar as 3.000 mais recentes
   * de novo. O custo de UMA mensagem era proporcional ao tamanho do histórico inteiro, o que não
   * escala com muitos clientes. Agora o custo de uma mensagem nova é o dela.
   */
  const marcaRef = useRef<number | null>(null);
  const totalRef = useRef<number | null>(null);

  function recarregar(completo = false): Promise<void> {
    const incremental = !completo && marcaRef.current !== null;
    const url = incremental ? `/api/mensagens-extra?desde=${marcaRef.current}` : "/api/mensagens-extra";
    return fetch(url, {
      // O cache do navegador faria a revalidação sozinho, mas de um jeito que o código não enxerga
      // (ele entrega um 200 vindo do cache). Fazendo à mão dá pra SABER que nada mudou e não mexer
      // no estado — o que evita re-render inútil da tela de Conversas a cada batida.
      cache: "no-store",
      headers: etagRef.current ? { "if-none-match": etagRef.current } : undefined,
    })
      .then(async (r) => {
        if (r.status === 304) return;
        const etag = r.headers.get("etag");
        const parcial = r.headers.get("x-mensagens-parcial") === "1";
        const total = Number(r.headers.get("x-mensagens-total"));
        const marca = Number(r.headers.get("x-mensagens-marca"));
        const dados = (await r.json()) as Record<string, ConvMensagem[]>;

        if (parcial) {
          // Quantas das que vieram a tela ainda não conhecia. Se o total do servidor for diferente
          // de "o que eu tinha + as novas", alguma foi apagada (por outra aba, outra pessoa, ou
          // uma limpeza) — e um delta não tem como contar isso. Lista inteira, uma vez.
          const conhecidas = new Set<string>();
          for (const msgs of Object.values(ultimoSincronizadoRef.current)) for (const m of msgs) if (m.id) conhecidas.add(m.id);
          let novas = 0;
          for (const msgs of Object.values(dados)) for (const m of msgs) if (m.id && !conhecidas.has(m.id)) novas++;
          if (totalRef.current !== null && Number.isFinite(total) && total !== totalRef.current + novas) {
            return recarregar(true);
          }
          ultimoSincronizadoRef.current = fundirMensagensPorContato(ultimoSincronizadoRef.current, dados);
        } else {
          ultimoSincronizadoRef.current = dados;
        }

        if (etag) etagRef.current = etag;
        if (Number.isFinite(total)) totalRef.current = total;
        if (Number.isFinite(marca) && marca > 0) marcaRef.current = marca;
        setMensagensExtraPorContato((prev) => fundirMensagensPorContato(prev, dados));
      })
      .catch((erro) => console.error("Falha ao carregar mensagens extras da API:", erro));
  }

  useEffect(() => {
    recarregar().finally(() => {
      carregadoRef.current = true;
    });

    // Polling — mensagem nova (do webhook do WhatsApp/Instagram) precisa aparecer sozinha, sem
    // depender de recarregar a página, igual todo app de mensagem de verdade.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!carregadoRef.current) return;
    const temporizador = setTimeout(() => {
      const { upserts, deletarIds } = calcularDelta(ultimoSincronizadoRef.current, mensagensExtraPorContato);
      if (!upserts.length && !deletarIds.length) return;
      ultimoSincronizadoRef.current = mensagensExtraPorContato;
      // Gravar muda o servidor, então a versão guardada acabou de ficar velha. Sem descartá-la, a
      // próxima batida mandaria um ETag antigo, e um `304` faria a tela ignorar o que ela mesma
      // acabou de gravar. O total também fica desconhecido: esta gravação pode ter criado ou
      // apagado mensagens, e a checagem de apagamento da próxima batida compararia com um número
      // velho e pediria a lista inteira à toa. A `marca` fica: o delta seguinte traz de volta as
      // linhas que esta gravação mexeu, já com o status do servidor.
      etagRef.current = null;
      totalRef.current = null;
      fetch("/api/mensagens-extra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upserts, deletarIds }),
      }).catch((erro) => console.error("Falha ao sincronizar mensagens extras na API:", erro));
    }, 400);
    return () => clearTimeout(temporizador);
  }, [mensagensExtraPorContato]);

  return (
    <MensagensExtraContext.Provider
      value={{ mensagensExtraPorContato, setMensagensExtraPorContato, recarregar }}
    >
      {children}
    </MensagensExtraContext.Provider>
  );
}

export function useMensagensExtra() {
  const ctx = useContext(MensagensExtraContext);
  if (!ctx) throw new Error("useMensagensExtra precisa estar dentro de MensagensExtraProvider");
  return ctx;
}
