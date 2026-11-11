import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { normalizarContaCanal } from "@/lib/integracoes/conta-canal-normalizar";

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
  const [conversas, cards, funis] = await Promise.all([
    prisma.conversa.findMany({
      where: { workspaceId, ehGrupo: false, arquivada: false },
      select: { nome: true, contaCanal: true },
    }),
    prisma.negocioCard.findMany({
      where: { workspaceId },
      select: { nome: true, etapa: { select: { funilId: true } } },
    }),
    prisma.funil.findMany({ where: { workspaceId }, select: { id: true, contaCanal: true } }),
  ]);

  /*
   * A CONTA SEGUE A MESMA REGRA DA RECONCILIAÇÃO — por funil, não pelo workspace.
   *
   * Era workspace inteiro, e com funil por número isso passou a contar menos do que há pra fazer:
   * quem tem card no quadro de um número e não tem no do outro está desalinhado, e a conta antiga
   * dizia que estava tudo certo. O botão sumiria com trabalho pendente, que é pior do que o botão
   * aparecer à toa.
   */
  const porConta = new Map<string, string>();
  for (const f of funis) {
    if (f.contaCanal) porConta.set(normalizarContaCanal(f.contaCanal), f.id);
  }
  const funilSemNumero = funis.find((f) => !f.contaCanal)?.id ?? null;

  const chavesPorFunil = new Map<string, Set<string>>();
  for (const card of cards) {
    const funilId = card.etapa?.funilId;
    if (!funilId) continue;
    const jaTem = chavesPorFunil.get(funilId) ?? new Set<string>();
    jaTem.add(chaveDeContato(card.nome));
    chavesPorFunil.set(funilId, jaTem);
  }

  const semCard = conversas.filter((c) => {
    const destino = (c.contaCanal ? porConta.get(normalizarContaCanal(c.contaCanal)) : null) ?? funilSemNumero;
    // Sem funil de destino não há o que criar, então não há desalinhamento a relatar.
    return destino ? !chavesPorFunil.get(destino)?.has(chaveDeContato(c.nome)) : false;
  }).length;

  const chavesComConversa = new Set(conversas.map((c) => chaveDeContato(c.nome)));
  const semConversa = cards.filter((c) => !chavesComConversa.has(chaveDeContato(c.nome))).length;
  return { total: semCard + semConversa };
}

export async function reconciliarFunilEConversas(workspaceId: string): Promise<Reconciliacao> {
  const [conversas, cards, contatos, funis] = await Promise.all([
    prisma.conversa.findMany({
      where: { workspaceId },
      select: { nome: true, canal: true, contato: true, contaCanal: true, ehGrupo: true, arquivada: true, contatoId: true },
    }),
    prisma.negocioCard.findMany({
      where: { workspaceId },
      // `etapa.funilId` entra porque "já tem card?" passou a ser por funil, e não pelo workspace.
      select: { id: true, nome: true, origem: true, contaCanal: true, etapa: { select: { funilId: true } } },
    }),
    prisma.contato.findMany({
      where: { workspaceId },
      select: { id: true, nome: true, whatsapp: true, instagram: true, instagramId: true },
    }),
    prisma.funil.findMany({
      where: { workspaceId },
      include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
      orderBy: { id: "asc" },
    }),
  ]);

  const chavesComConversa = new Set(conversas.map((c) => chaveDeContato(c.nome)));
  const contatoPorChave = new Map(contatos.map((c) => [chaveDeContato(c.nome), c]));

  /* ---------------------------------------- conversa que não tem negócio ---- */

  /*
   * CADA CONVERSA VAI PRO FUNIL DO NÚMERO DELA.
   *
   * Era um funil só: `findFirst` pegava o primeiro da empresa e TODA conversa virava card nele.
   * Enquanto havia um quadro, dava no mesmo. Agora o funil é de um número ("nenhum funil pode ter
   * mais do que um número; não pode receber mensagens de WhatsApps diferentes"), e jogar tudo no
   * primeiro quadro encheria o funil de um número com os leads do outro — que é o amontoado que
   * separar por número existe pra desfazer.
   *
   * Funil SEM número continua existindo e recebe o que não tem número próprio: conversa antiga, de
   * antes de o CRM gravar de qual conexão ela veio, e conversa de um número que ainda não tem
   * quadro. Sem nenhum funil assim, essas conversas ficam de fora em vez de cair no quadro de
   * outra pessoa — não ter card é um problema menor que ter o card errado.
   */
  const porConta = new Map<string, (typeof funis)[number]>();
  for (const f of funis) {
    if (f.contaCanal) porConta.set(normalizarContaCanal(f.contaCanal), f);
  }
  const funilSemNumero = funis.find((f) => !f.contaCanal) ?? null;
  const funilDaConversa = (contaCanal: string | null) =>
    (contaCanal ? porConta.get(normalizarContaCanal(contaCanal)) : null) ?? funilSemNumero;

  /*
   * "JÁ TEM CARD?" É POR FUNIL, não pelo workspace inteiro.
   *
   * A mesma pessoa pode falar por dois números e, nesse caso, estar nos dois quadros de propósito.
   * Perguntando do workspace inteiro, o segundo quadro nunca receberia ninguém que já tivesse
   * falado pelo primeiro.
   */
  const chavesPorFunil = new Map<string, Set<string>>();
  for (const card of cards) {
    const funilId = card.etapa?.funilId;
    if (!funilId) continue;
    const jaTem = chavesPorFunil.get(funilId) ?? new Set<string>();
    jaTem.add(chaveDeContato(card.nome));
    chavesPorFunil.set(funilId, jaTem);
  }

  const aCriar = new Map<string, typeof conversas>();
  for (const conversa of conversas) {
    if (conversa.ehGrupo || conversa.arquivada) continue;
    const destino = funilDaConversa(conversa.contaCanal);
    const etapa = destino?.etapas[0];
    if (!etapa) continue;
    if (chavesPorFunil.get(destino.id)?.has(chaveDeContato(conversa.nome))) continue;
    aCriar.set(etapa.id, [...(aCriar.get(etapa.id) ?? []), conversa]);
  }

  let cardsCriados = 0;
  for (const [etapaId, daEtapa] of aCriar) {
    const menor = await prisma.negocioCard.aggregate({ where: { etapaId }, _min: { ordem: true } });
    let ordem = Math.min(menor._min.ordem ?? 0, 0) - daEtapa.length;
    const criados = await prisma.negocioCard
      .createMany({
        data: daEtapa.map((conversa) => ({
          id: `${workspaceId}-${slugId(conversa.nome)}-${Date.now()}-${ordem}`,
          etapaId,
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
    cardsCriados += criados.count;
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
