import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CANAL_INSTAGRAM, CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import { ehIdentificadorDeGrupo } from "@/lib/contatos/upsert";

/**
 * Apaga tudo que um canal de WhatsApp trouxe pro CRM — conversas, mensagens, contatos criados
 * sozinhos e cards de funil que nasceram desses leads.
 *
 * Por que isso existe: desconectar só mudava o status da integração, e o espelho do WhatsApp
 * ficava para trás (contatos, cards no funil com JID de grupo no lugar do telefone, pendências no
 * Início, conversa órfã aberta). Ao conectar outro canal por cima, os dados dos dois se misturavam
 * sem nenhuma forma de distinguir de onde veio o quê.
 *
 * SÓ apaga o que dá pra atribuir ao canal com certeza — nada criado à mão pela pessoa é tocado:
 *   - `MensagemExtra.canal` marca a conexão que trouxe a mensagem;
 *   - `Contato.criadoVia = "whatsapp"` só existe em contato que nasceu de mensagem recebida
 *     (contato cadastrado na tela de Contatos é `"manual"` e fica);
 *   - `NegocioCard.origem = "WhatsApp"` é o card criado automaticamente na etapa de entrada
 *     (card criado à mão tem outra origem e fica).
 *
 * É destrutivo e irreversível — quem chama precisa ter confirmado com a pessoa antes.
 */
export type ResumoLimpeza = {
  conversas: number;
  mensagens: number;
  contatos: number;
  cards: number;
};

/** Filtro de `MensagemExtra` por conexão. `canal: null` (mensagem antiga, de antes dessa coluna
 * existir) conta como não oficial: é de onde vem todo o histórico já espelhado até aqui. Precisa
 * ser `OR` e não `in` porque o `in` do Prisma não casa NULL. */
const FILTRO_CANAL: Record<"nao_oficial" | "oficial", { OR: { canal: string | null }[] }> = {
  nao_oficial: { OR: [{ canal: CANAL_NAO_OFICIAL }, { canal: null }] },
  oficial: { OR: [{ canal: CANAL_OFICIAL }] },
};

export async function limparDadosDoWhatsApp(
  workspaceId: string,
  conexao: "nao_oficial" | "oficial",
): Promise<ResumoLimpeza> {
  const filtroCanal = FILTRO_CANAL[conexao];

  // 1) Mensagens do canal. Guarda os nomes de contato ANTES de apagar — é por `contato` (nome) que
  // `MensagemExtra` se liga à `Conversa`, então depois do delete não teria como achar as conversas.
  const mensagensDoCanal = await prisma.mensagemExtra.findMany({
    where: { workspaceId, ...filtroCanal },
    select: { contato: true },
  });
  const nomesEnvolvidos = [...new Set(mensagensDoCanal.map((m) => m.contato))];

  const mensagens = await prisma.mensagemExtra.deleteMany({
    where: { workspaceId, ...filtroCanal },
  });

  // 2) Conversas de WhatsApp que ficaram sem nenhuma mensagem — se sobrou mensagem de outro canal
  // com o mesmo contato, a conversa continua valendo e não é tocada.
  const candidatas = await prisma.conversa.findMany({
    where: { workspaceId, canal: "WhatsApp" },
    select: { id: true, nome: true },
  });
  const aindaTemMensagem = new Set(
    (
      await prisma.mensagemExtra.findMany({
        where: { workspaceId, contato: { in: candidatas.map((c) => c.nome) } },
        select: { contato: true },
      })
    ).map((m) => m.contato),
  );
  const idsParaApagar = candidatas.filter((c) => !aindaTemMensagem.has(c.nome)).map((c) => c.id);
  const conversas = await prisma.conversa.deleteMany({ where: { id: { in: idsParaApagar } } });

  // 3) Contatos que nasceram do WhatsApp (nunca os cadastrados à mão).
  const contatos = await prisma.contato.deleteMany({
    where: { workspaceId, criadoVia: "whatsapp" },
  });

  // 4) Cards de funil criados automaticamente a partir desses leads.
  const cards = await prisma.negocioCard.deleteMany({
    where: { workspaceId, origem: "WhatsApp", nome: { in: nomesEnvolvidos } },
  });

  return {
    conversas: conversas.count,
    mensagens: mensagens.count,
    contatos: contatos.count,
    cards: cards.count,
  };
}

/**
 * Remove contatos e cards de funil que na verdade são GRUPOS do WhatsApp — entulho deixado por
 * antes de `criarContatoPeloWhatsAppSeNaoExistir` recusar identificador de grupo. Apareciam na
 * carteira de clientes e no funil como "+120363422457482263", que não é telefone de ninguém.
 *
 * Diferente da limpeza por canal, isto NÃO é opcional nem depende de conexão: é lixo em qualquer
 * cenário. A conversa do grupo em si não é tocada — ela é legítima e continua na caixa de entrada.
 */
export async function removerGruposViradosContato(workspaceId: string): Promise<{ contatos: number; cards: number }> {
  const candidatos = await prisma.contato.findMany({
    where: { workspaceId, criadoVia: "whatsapp" },
    select: { id: true, nome: true, whatsapp: true },
  });
  const grupos = candidatos.filter((c) => ehIdentificadorDeGrupo(c.whatsapp));
  if (!grupos.length) return { contatos: 0, cards: 0 };

  // Cards primeiro: depois de apagar o contato não dá mais pra saber quais cards eram dele.
  const cards = await prisma.negocioCard.deleteMany({
    where: { workspaceId, origem: "WhatsApp", nome: { in: grupos.map((g) => g.nome) } },
  });
  const contatos = await prisma.contato.deleteMany({ where: { id: { in: grupos.map((g) => g.id) } } });

  return { contatos: contatos.count, cards: cards.count };
}

/**
 * Remove o entulho que as tentativas de baixar anexo do Instagram sem autenticação deixaram: o CDN
 * respondia uma página HTML com status 200, e ela era guardada como se fosse arquivo — virando um
 * card de download de centenas de KB grudado em mensagens que muitas vezes eram só texto.
 *
 * Não apaga a mensagem: tira só o anexo inválido, preservando o texto que a pessoa escreveu.
 */
export async function limparAnexosInvalidosInstagram(workspaceId: string): Promise<number> {
  const mensagens = await prisma.mensagemExtra.findMany({
    where: { workspaceId, canal: CANAL_INSTAGRAM, NOT: { extras: { equals: Prisma.DbNull } } },
    select: { id: true, extras: true },
  });

  let corrigidas = 0;
  for (const mensagem of mensagens) {
    const extras = mensagem.extras as { documento?: { url?: string } } | null;
    const url = extras?.documento?.url ?? "";
    // Documento cujo conteúdo embutido é HTML — nunca foi arquivo de verdade.
    if (!url.startsWith("data:text/html")) continue;

    await prisma.mensagemExtra.update({ where: { id: mensagem.id }, data: { extras: Prisma.DbNull } });
    corrigidas += 1;
  }
  return corrigidas;
}
