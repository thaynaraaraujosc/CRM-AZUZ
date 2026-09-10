import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { chaveDeContato } from "@/lib/contatos/chave-nome";

/**
 * O negócio daquele contato, achado pelo nome NORMALIZADO.
 *
 * O banco compara texto com texto, e o mesmo contato chega com o nome escrito de jeitos diferentes
 * conforme o caminho: espaço sobrando no fim, maiúsculas do nome de perfil, espaço duplo no meio.
 * Buscar por igualdade exata fazia o CRM não achar o card que já existia (e criar outro) e não
 * achar o card pra subir pro topo quando chegava mensagem.
 *
 * Faz uma busca ampla por igualdade exata primeiro, que é a barata e resolve o caso comum, e só
 * cai pra varredura normalizada quando ela não acha nada. A varredura é limitada ao workspace.
 */
async function cardDoContato(workspaceId: string, contatoNome: string) {
  const exato = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome } });
  if (exato) return exato;

  const chave = chaveDeContato(contatoNome);
  if (!chave) return null;
  const candidatos = await prisma.negocioCard.findMany({ where: { workspaceId } });
  return candidatos.find((c) => chaveDeContato(c.nome) === chave) ?? null;
}

/**
 * Coloca um lead recém-criado na primeira etapa (menor `ordem`, não pelo nome: o workspace pode
 * ter chamado a primeira etapa de "Novo", "Entrada", "Lead recebido" etc.) do primeiro funil do
 * workspace. Regra de negócio: TODO novo lead entra no funil, sempre pela primeira etapa.
 *
 * Só chame isso quando o contato ACABOU de ser criado nesta mesma chamada (nunca pra um contato
 * que já existia): mover um contato existente de etapa é decisão do usuário, jamais automática só
 * porque chegou mais uma mensagem dele. Idempotente por natureza: se por algum motivo o contato já
 * tiver um card em qualquer funil (reprocessamento do mesmo evento, corrida entre dois webhooks),
 * não duplica.
 */
export async function entrarNaPrimeiraEtapaComoNovoLead(params: {
  workspaceId: string;
  contatoNome: string;
  /** Conversa de grupo: grupo não entra no funil nem em automação (ver dentro da função). */
  ehGrupo?: boolean;
  origem: string;
  /** Conexão que originou o negócio. É o que faz o card sumir do funil quando aquele canal é
   * desconectado, e voltar quando ele reconecta (ver o campo no schema). */
  contaCanal?: string | null;
  /** Funil escolhido pra este tipo de lead. Ausente = o primeiro funil do workspace, como sempre. */
  funilId?: string | null;
  /** Etapa escolhida. Ausente = a primeira etapa daquele funil. */
  etapaId?: string | null;
}) {
  const { workspaceId, contatoNome, ehGrupo = false, origem, contaCanal } = params;

  // Grupo do WhatsApp nunca vira negócio. Um grupo não é um lead: ele existe no CRM só pra ser
  // respondido em Conversas, sem sair do sistema. A regra vive AQUI, e não só em quem chama, pra
  // valer pra qualquer caminho que venha a criar lead no futuro (importação, outro canal, gatilho
  // de automação) sem depender de cada um lembrar de checar.
  if (ehGrupo) return null;

  // Conversa arquivada também não vira negócio. Arquivar é o gesto de "isso aqui não está em
  // atendimento": se gerasse card, o funil voltaria a encher exatamente com o que a pessoa acabou
  // de tirar da caixa de entrada. Quando ela voltar a mandar mensagem a conversa desarquiva sozinha
  // (ver `upsertConversaAoReceberMensagem`), e aí sim entra no funil pelo caminho normal.
  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    select: { arquivada: true },
  });
  if (conversa?.arquivada) return null;

  // Comparação pelo nome NORMALIZADO, não por texto exato. O mesmo contato chega com o nome
  // escrito de jeitos diferentes conforme o caminho ("Thais " com espaço, "LUCAS ARANTES" em
  // maiúsculas), e comparar cru fazia a mesma pessoa ganhar um segundo card a cada variação. Foi
  // assim que a conta real chegou a 69 negócios no funil pra 35 conversas.
  const jaTemCard = await cardDoContato(workspaceId, contatoNome);
  if (jaTemCard) return jaTemCard;

  // "Primeiro funil do workspace": mesma convenção já usada em outras telas (trafego/page.tsx,
  // funilAtivoId inicial em funis-context.tsx): o primeiro da lista, não um campo "principal"
  // dedicado (que não existe no schema). Workspace sem nenhum funil/etapa ainda: não há onde
  // colocar o lead: fica só como Contato, sem quebrar o recebimento da mensagem.
  //
  // `funilId`/`etapaId` são o destino ESCOLHIDO, quando existe um. É o que permite lead de
  // Instagram cair num funil próprio em vez de se misturar com o comercial. Sem escolha, ou com
  // uma escolha que já não existe (funil apagado), cai de volta na convenção acima: nunca deixar
  // o lead de fora do funil por causa de uma configuração desatualizada.
  const etapaEscolhida = params.etapaId
    ? await prisma.funilEtapa.findFirst({
        where: { id: params.etapaId, funil: { workspaceId } },
        include: { cards: { select: { ordem: true } } },
      })
    : null;

  const funil = etapaEscolhida
    ? null
    : await prisma.funil.findFirst({
        where: { workspaceId, ...(params.funilId ? { id: params.funilId } : {}) },
        include: { etapas: { orderBy: { ordem: "asc" }, take: 1, include: { cards: { select: { ordem: true } } } } },
      }) ??
      // O funil escolhido sumiu: volta pro primeiro do workspace em vez de perder o lead.
      (await prisma.funil.findFirst({
        where: { workspaceId },
        include: { etapas: { orderBy: { ordem: "asc" }, take: 1, include: { cards: { select: { ordem: true } } } } },
      }));

  const primeiraEtapa = etapaEscolhida ?? funil?.etapas[0];
  if (!primeiraEtapa) return null;

  // Lead novo entra no TOPO da coluna, não no fim. Como a listagem ordena por `ordem` crescente,
  // isso é uma ordem MENOR que a de todo mundo. Entrando no fim, quem acabou de mandar mensagem
  // caía embaixo de dezenas de cards antigos e a pessoa que atende só via o lead novo rolando a
  // coluna inteira: mensagem nova é justamente o que precisa ser visto primeiro.
  //
  // Fica negativo, e é de propósito: assim nenhum card existente precisa ser renumerado (o que
  // brigaria com a ordem que a pessoa arrumou na mão). O PUT de `/api/funis` normaliza tudo pra
  // 0..n na próxima vez que a tela salvar, mantendo a posição.
  const menorOrdem = primeiraEtapa.cards.reduce((min, c) => Math.min(min, c.ordem), 0);

  return prisma.negocioCard.create({
    data: {
      id: `${workspaceId}-${slugId(contatoNome)}-${Date.now()}`,
      etapaId: primeiraEtapa.id,
      ordem: menorOrdem - 1,
      workspaceId,
      nome: contatoNome,
      valor: "-",
      origem,
      contaCanal,
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    },
  });
}

/**
 * Sobe o card de um contato pro TOPO da coluna em que ele está, quando chega mensagem nova dele.
 *
 * Não muda de ETAPA: isso continua sendo decisão de quem atende. Muda só a posição DENTRO da
 * coluna, pra a coluna funcionar como caixa de entrada: quem falou por último aparece primeiro, em
 * vez de ficar perdido no meio de dezenas de cards parados.
 *
 * Igual ao lead novo (ver acima), a ordem nova é MENOR que a de todo mundo da etapa. Negativa se
 * precisar. Nenhum outro card é renumerado, e o PUT de `/api/funis` normaliza pra 0..n no próximo
 * salvamento da tela.
 *
 * Falha em silêncio de propósito: isto é um detalhe de apresentação do funil, e uma mensagem nunca
 * pode deixar de ser gravada porque a reordenação não deu certo.
 */
export async function subirCardParaOTopo(workspaceId: string, contatoNome: string) {
  try {
    const card = await cardDoContato(workspaceId, contatoNome);
    if (!card) return;

    const menor = await prisma.negocioCard.aggregate({
      where: { etapaId: card.etapaId },
      _min: { ordem: true },
    });
    const menorOrdem = menor._min.ordem ?? 0;
    // Já está no topo: não escreve à toa (o webhook roda a cada mensagem recebida).
    if (card.ordem <= menorOrdem) return;

    await prisma.negocioCard.update({ where: { id: card.id }, data: { ordem: menorOrdem - 1 } });
  } catch (erro) {
    console.error("[funil] falha ao subir o card pro topo:", erro);
  }
}
