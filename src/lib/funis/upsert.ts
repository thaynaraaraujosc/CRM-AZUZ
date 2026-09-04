import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

/**
 * Coloca um lead recém-criado na primeira etapa (menor `ordem`, não pelo nome — o workspace pode
 * ter chamado a primeira etapa de "Novo", "Entrada", "Lead recebido" etc.) do primeiro funil do
 * workspace. Regra de negócio: TODO novo lead entra no funil, sempre pela primeira etapa.
 *
 * Só chame isso quando o contato ACABOU de ser criado nesta mesma chamada (nunca pra um contato
 * que já existia) — mover um contato existente de etapa é decisão do usuário, jamais automática só
 * porque chegou mais uma mensagem dele. Idempotente por natureza: se por algum motivo o contato já
 * tiver um card em qualquer funil (reprocessamento do mesmo evento, corrida entre dois webhooks),
 * não duplica.
 */
export async function entrarNaPrimeiraEtapaComoNovoLead(params: {
  workspaceId: string;
  contatoNome: string;
  /** Conversa de grupo — grupo não entra no funil nem em automação (ver dentro da função). */
  ehGrupo?: boolean;
  origem: string;
  /** Conexão que originou o negócio — é o que faz o card sumir do funil quando aquele canal é
   * desconectado, e voltar quando ele reconecta (ver o campo no schema). */
  contaCanal?: string | null;
}) {
  const { workspaceId, contatoNome, ehGrupo = false, origem, contaCanal } = params;

  // Grupo do WhatsApp nunca vira negócio. Um grupo não é um lead: ele existe no CRM só pra ser
  // respondido em Conversas, sem sair do sistema. A regra vive AQUI, e não só em quem chama, pra
  // valer pra qualquer caminho que venha a criar lead no futuro (importação, outro canal, gatilho
  // de automação) sem depender de cada um lembrar de checar.
  if (ehGrupo) return null;

  // Conversa arquivada também não vira negócio. Arquivar é o gesto de "isso aqui não está em
  // atendimento" — se gerasse card, o funil voltaria a encher exatamente com o que a pessoa acabou
  // de tirar da caixa de entrada. Quando ela voltar a mandar mensagem a conversa desarquiva sozinha
  // (ver `upsertConversaAoReceberMensagem`), e aí sim entra no funil pelo caminho normal.
  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    select: { arquivada: true },
  });
  if (conversa?.arquivada) return null;

  const jaTemCard = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome } });
  if (jaTemCard) return jaTemCard;

  // "Primeiro funil do workspace" — mesma convenção já usada em outras telas (trafego/page.tsx,
  // funilAtivoId inicial em funis-context.tsx): o primeiro da lista, não um campo "principal"
  // dedicado (que não existe no schema). Workspace sem nenhum funil/etapa ainda: não há onde
  // colocar o lead — fica só como Contato, sem quebrar o recebimento da mensagem.
  const funil = await prisma.funil.findFirst({
    where: { workspaceId },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1, include: { cards: { select: { ordem: true } } } } },
  });
  const primeiraEtapa = funil?.etapas[0];
  if (!primeiraEtapa) return null;

  // Lead novo entra no TOPO da coluna, não no fim. Como a listagem ordena por `ordem` crescente,
  // isso é uma ordem MENOR que a de todo mundo. Entrando no fim, quem acabou de mandar mensagem
  // caía embaixo de dezenas de cards antigos e a pessoa que atende só via o lead novo rolando a
  // coluna inteira — mensagem nova é justamente o que precisa ser visto primeiro.
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
      valor: "—",
      origem,
      contaCanal,
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    },
  });
}
