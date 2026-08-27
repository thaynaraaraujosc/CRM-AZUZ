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
}) {
  const { workspaceId, contatoNome, ehGrupo = false, origem } = params;

  // Grupo do WhatsApp nunca vira negócio. Um grupo não é um lead: ele existe no CRM só pra ser
  // respondido em Conversas, sem sair do sistema. A regra vive AQUI, e não só em quem chama, pra
  // valer pra qualquer caminho que venha a criar lead no futuro (importação, outro canal, gatilho
  // de automação) sem depender de cada um lembrar de checar.
  if (ehGrupo) return null;

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

  const maiorOrdem = primeiraEtapa.cards.reduce((max, c) => Math.max(max, c.ordem), -1);

  return prisma.negocioCard.create({
    data: {
      id: `${workspaceId}-${slugId(contatoNome)}-${Date.now()}`,
      etapaId: primeiraEtapa.id,
      ordem: maiorOrdem + 1,
      workspaceId,
      nome: contatoNome,
      valor: "—",
      origem,
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    },
  });
}
