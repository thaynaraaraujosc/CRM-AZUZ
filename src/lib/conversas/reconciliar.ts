import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { chaveDeContato } from "@/lib/contatos/chave-nome";

/**
 * Funil e Conversas contando a MESMA história, sempre.
 *
 * A regra é essa e não tem exceção de conveniência: quem está no funil está em Conversas, e quem
 * está em Conversas está no funil. Antes só existia meia regra, e ela era manual: um botão
 * "Trazer conversas" que criava card a partir de conversa. O caminho de volta não existia, então
 * negócio que nasceu por outro caminho (contato criado, lead do Instagram, importação) ficava no
 * funil sem conversa nenhuma. Na tela isso vira "conversei com a pessoa e a conversa não chegou",
 * que é indistinguível de mensagem perdida.
 *
 * Roda sozinho, pelo relógio, nos dois sentidos. Não apaga nada: só cria o lado que falta.
 *
 * As duas exceções que já existiam continuam valendo, porque elas são decisão de produto e não
 * falha:
 *
 * - grupo do WhatsApp nunca vira negócio (um grupo não é um lead);
 * - conversa arquivada nunca vira negócio (arquivar é dizer "isso não está em atendimento").
 */

export type Reconciliacao = {
  /** Conversas que ganharam negócio no funil. */
  cardsCriados: number;
  /** Negócios que ganharam conversa na caixa de entrada. */
  conversasCriadas: number;
  /** Negócios que não deu pra ligar a nenhuma conversa: o contato não tem WhatsApp nem Instagram. */
  semComoLigar: string[];
};

/**
 * Quantos registros estão fora de compasso, sem consertar nada.
 *
 * Serve pra tela decidir se mostra o botão de alinhar. Botão de manutenção que fica na tela pra
 * sempre é conta que o cliente paga: ele sugere que tem alguma coisa pra fazer quando não tem.
 */
export async function contarDesalinhados(workspaceId: string): Promise<{ total: number }> {
  const [conversas, cards] = await Promise.all([
    prisma.conversa.findMany({
      where: { workspaceId, ehGrupo: false, arquivada: false },
      select: { nome: true },
    }),
    prisma.negocioCard.findMany({ where: { workspaceId }, select: { nome: true } }),
  ]);
  const chavesComCard = new Set(cards.map((c) => chaveDeContato(c.nome)));
  const chavesComConversa = new Set(conversas.map((c) => chaveDeContato(c.nome)));
  const semCard = conversas.filter((c) => !chavesComCard.has(chaveDeContato(c.nome))).length;
  const semConversa = cards.filter((c) => !chavesComConversa.has(chaveDeContato(c.nome))).length;
  return { total: semCard + semConversa };
}

export async function reconciliarFunilEConversas(workspaceId: string): Promise<Reconciliacao> {
  const [conversas, cards, contatos, funil] = await Promise.all([
    prisma.conversa.findMany({
      where: { workspaceId },
      select: { nome: true, canal: true, contato: true, contaCanal: true, ehGrupo: true, arquivada: true, contatoId: true },
    }),
    prisma.negocioCard.findMany({
      where: { workspaceId },
      select: { id: true, nome: true, origem: true, contaCanal: true },
    }),
    prisma.contato.findMany({
      where: { workspaceId },
      select: { id: true, nome: true, whatsapp: true, instagram: true, instagramId: true },
    }),
    prisma.funil.findFirst({
      where: { workspaceId },
      include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
    }),
  ]);

  const chavesComCard = new Set(cards.map((c) => chaveDeContato(c.nome)));
  const chavesComConversa = new Set(conversas.map((c) => chaveDeContato(c.nome)));
  const contatoPorChave = new Map(contatos.map((c) => [chaveDeContato(c.nome), c]));

  /* ---------------------------------------- conversa que não tem negócio ---- */
  const primeiraEtapa = funil?.etapas[0];
  const semCard = conversas.filter(
    (c) => !c.ehGrupo && !c.arquivada && !chavesComCard.has(chaveDeContato(c.nome)),
  );

  let cardsCriados = 0;
  if (primeiraEtapa && semCard.length) {
    const menor = await prisma.negocioCard.aggregate({
      where: { etapaId: primeiraEtapa.id },
      _min: { ordem: true },
    });
    let ordem = Math.min(menor._min.ordem ?? 0, 0) - semCard.length;
    const criados = await prisma.negocioCard
      .createMany({
        data: semCard.map((conversa) => ({
          id: `${workspaceId}-${slugId(conversa.nome)}-${Date.now()}-${ordem}`,
          etapaId: primeiraEtapa.id,
          ordem: ordem++,
          workspaceId,
          nome: conversa.nome,
          valor: "",
          origem: conversa.canal,
          // Sem isto o negócio entraria sem dono e não sumiria ao desconectar o canal de onde veio.
          contaCanal: conversa.contaCanal,
          dias: "Hoje",
          data: new Date().toISOString().slice(0, 10),
        })),
        skipDuplicates: true,
      })
      .catch((erro) => {
        console.error("[reconciliar] falha ao criar negócios a partir de conversas:", erro);
        return { count: 0 };
      });
    cardsCriados = criados.count;
  }

  /* ---------------------------------------- negócio que não tem conversa ---- */
  const semConversa = cards.filter((c) => !chavesComConversa.has(chaveDeContato(c.nome)));
  let conversasCriadas = 0;
  const semComoLigar: string[] = [];

  for (const card of semConversa) {
    const contato = contatoPorChave.get(chaveDeContato(card.nome));
    // Pra existir conversa é preciso saber PARA ONDE ela fala. Sem telefone nem Instagram, criar a
    // linha só produziria uma conversa que não manda nem recebe: pior que não ter.
    const destino = contato?.whatsapp?.trim() || contato?.instagramId?.trim() || null;
    if (!destino) {
      semComoLigar.push(card.nome);
      continue;
    }
    const ehInstagram = !contato?.whatsapp?.trim() && Boolean(contato?.instagramId?.trim());
    await prisma.conversa
      .create({
        data: {
          id: `${workspaceId}-${slugId(card.nome)}-${Date.now()}`,
          workspaceId,
          nome: card.nome,
          initials: iniciais(card.nome),
          canal: ehInstagram ? "Instagram" : "WhatsApp",
          contato: destino,
          contatoId: contato?.id ?? null,
          origem: card.origem || "Direto",
          status: "Não respondido",
          // A conexão vem do próprio negócio: é ela que decide se a conversa aparece na caixa de
          // entrada e por onde a resposta sai.
          contaCanal: card.contaCanal,
        },
      })
      .then(() => {
        conversasCriadas += 1;
      })
      .catch((erro) => {
        // Corrida com o webhook criando a mesma conversa: o próximo ciclo já encontra tudo certo.
        console.error(`[reconciliar] falha ao criar a conversa de ${card.nome}:`, erro);
      });
  }

  return { cardsCriados, conversasCriadas, semComoLigar };
}

function iniciais(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Passa a reconciliação em todo workspace. Chamado pelo relógio.
 *
 * No estado normal (os dois lados já batendo) a rodada só lê. Nada é apagado em hipótese nenhuma:
 * esta função só cria o lado que falta.
 */
export async function reconciliarTodosOsWorkspaces(): Promise<{
  workspaces: number;
  cardsCriados: number;
  conversasCriadas: number;
}> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  let cardsCriados = 0;
  let conversasCriadas = 0;
  let tocados = 0;
  for (const w of workspaces) {
    const r = await reconciliarFunilEConversas(w.id).catch((erro) => {
      console.error(`[reconciliar] falha no workspace ${w.id}:`, erro);
      return { cardsCriados: 0, conversasCriadas: 0, semComoLigar: [] as string[] };
    });
    if (r.cardsCriados || r.conversasCriadas) tocados += 1;
    cardsCriados += r.cardsCriados;
    conversasCriadas += r.conversasCriadas;
  }
  return { workspaces: tocados, cardsCriados, conversasCriadas };
}
