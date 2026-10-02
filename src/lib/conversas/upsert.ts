import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

function iniciaisDe(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Cria (ou atualiza) a `Conversa` correspondente a uma mensagem recebida. Chamado pelos três
 * webhooks que gravam `MensagemExtra` (WhatsApp oficial, WhatsApp via QR/Baileys, Instagram), logo
 * depois de criar a mensagem em si. É o que faz uma conversa nova aparecer sozinha na tela assim
 * que chega a primeira mensagem de um número/@handle que ainda não tinha thread nenhuma. Resolve a
 * limitação antes documentada de "número novo não aparece na tela ainda".
 *
 * `id` é determinístico (`workspaceId` + slug do nome) de propósito: como a chave única real é
 * `[workspaceId, nome]`, gerar sempre o mesmo id pro mesmo par evita ficar acumulando ids órfãos
 * a cada upsert.
 */
export async function upsertConversaAoReceberMensagem(params: {
  workspaceId: string;
  nome: string;
  canal: string;
  contato?: string;
  origem?: string;
  /** Id do `Contato` já criado/casado pra essa mensagem (ver `src/lib/contatos/upsert.ts`). Grava
   * a FK de verdade em vez de depender só do match por `nome` em runtime no front. */
  contatoId?: string;
  /** `false` na importação de histórico (sync completo do WhatsApp ao conectar via QR Code).
   * Mensagem antiga não é "não lida" de verdade, incrementar o contador só gera badge enganoso.
   * Padrão `true` (mensagem chegando ao vivo). */
  contarComoNaoLida?: boolean;
  /** Grupo de WhatsApp: `nome` já é o nome do grupo nesse caso (não de uma pessoa), `contato` já
   * é o JID do grupo (`<id>@g.us`). Ver comentário do campo no schema. */
  ehGrupo?: boolean;
  participantesGrupo?: { nome: string; telefone: string }[];
  /** Conexão dona da conversa (`<provedor>:<número>`, ver `src/lib/integracoes/conta-canal.ts`):
   * é o que faz a caixa de entrada zerar ao desconectar e voltar inteira ao reconectar. */
  contaCanal?: string | null;
  /** Foto de perfil real (grupo ou pessoa). Ver comentário do campo no schema. */
  fotoUrl?: string | null;
  /** Descrição e data de criação real do grupo no WhatsApp. Só em grupo. */
  descricaoGrupo?: string | null;
  criacaoGrupo?: Date | null;
}) {
  const {
    workspaceId,
    nome,
    canal,
    contato,
    origem,
    contatoId,
    contarComoNaoLida = true,
    contaCanal,
    ehGrupo = false,
    participantesGrupo,
    fotoUrl,
    descricaoGrupo,
    criacaoGrupo,
  } = params;

  /*
   * ENFEITE NÃO PODE DERRUBAR A MENSAGEM.
   *
   * Foto de perfil, lista de participantes e descrição do grupo são decoração: a conversa funciona
   * inteira sem os três. Mesmo assim, qualquer um deles fazendo a escrita falhar levava junto a
   * CONVERSA e, com ela, a mensagem — a rota do webhook estourava e nada chegava ao CRM.
   *
   * Foi exatamente o que aconteceu, e por meses: `Conversa.fotoUrl` estava declarada sem
   * `@db.Text`, virava VARCHAR(191) no MySQL, e a URL de foto do WhatsApp (CDN da Meta, com token
   * de assinatura na query) não cabia. Toda conversa nova, de pessoa e de grupo, morria com "the
   * provided value is too long for the column's type", e a importação de histórico junto. A coluna
   * foi corrigida — mas o tipo de uma coluna decorativa não pode ser a única coisa entre o cliente
   * e a mensagem dele. Se algum desses campos impedir a gravação, por qualquer motivo, a conversa
   * entra sem enfeite e a mensagem chega.
   */
  const semEnfeite = { workspaceId, nome, canal, contato, origem, contatoId, contarComoNaoLida, ehGrupo, contaCanal };
  try {
    await gravarConversa({ ...semEnfeite, participantesGrupo, fotoUrl, descricaoGrupo, criacaoGrupo });
  } catch (erro) {
    console.error(`[conversas] falha ao gravar "${nome}" com foto/participantes; regravando sem eles:`, erro);
    await gravarConversa(semEnfeite);
  }
}

/** A escrita em si. Separada só pra poder ser repetida sem os campos decorativos (ver acima). */
async function gravarConversa(params: {
  workspaceId: string;
  nome: string;
  canal: string;
  contato?: string;
  origem?: string;
  contatoId?: string;
  contarComoNaoLida: boolean;
  ehGrupo: boolean;
  contaCanal?: string | null;
  participantesGrupo?: { nome: string; telefone: string }[];
  fotoUrl?: string | null;
  descricaoGrupo?: string | null;
  criacaoGrupo?: Date | null;
}) {
  const {
    workspaceId,
    nome,
    canal,
    contato,
    origem,
    contatoId,
    contarComoNaoLida,
    contaCanal,
    ehGrupo,
    participantesGrupo,
    fotoUrl,
    descricaoGrupo,
    criacaoGrupo,
  } = params;
  await prisma.conversa.upsert({
    where: { workspaceId_nome: { workspaceId, nome } },
    create: {
      id: `conversa-${workspaceId}-${slugId(nome)}`,
      workspaceId,
      nome,
      initials: iniciaisDe(nome),
      canal,
      contato,
      contatoId,
      origem: origem ?? "Direto",
      naoLidas: contarComoNaoLida ? 1 : 0,
      contaCanal,
      ehGrupo,
      participantesGrupo,
      fotoUrl,
      descricaoGrupo,
      criacaoGrupo,
    },
    // Grava/atualiza o contatoId também num update. Conversa antiga criada antes dessa FK existir
    // se auto-corrige assim que uma mensagem nova chega e o contato já foi resolvido. Participantes,
    // foto, descrição e data de criação só sobrescrevem quando veio um valor novo (busca na
    // Evolution pode falhar em silêncio. Não apaga um valor que já tinha sido resolvido antes).
    update: {
      ...(contatoId ? { contatoId } : {}),
      // Conversa criada antes desta coluna existir ganha dono na primeira mensagem nova.
      ...(contaCanal ? { contaCanal } : {}),
      // Lista VAZIA não sobrescreve uma lista boa. `[]` é um valor verdadeiro em JavaScript, então
      // uma busca que voltou sem participantes apagava os que já estavam guardados — o grupo perdia
      // a lista que tinha custado a chegar, e voltava a mostrar "0 participantes".
      ...(participantesGrupo?.length ? { participantesGrupo } : {}),
      ...(fotoUrl ? { fotoUrl } : {}),
      ...(descricaoGrupo ? { descricaoGrupo } : {}),
      ...(criacaoGrupo ? { criacaoGrupo } : {}),
      // Mensagem nova ao vivo desarquiva sozinha: arquivar quer dizer "essa conversa não está em
      // atendimento agora", não "nunca mais me mostre". Se a pessoa voltar a falar e a conversa
      // continuasse escondida em "Arquivadas", o atendimento se perderia em silêncio. Só vale pra
      // mensagem ao vivo: importação de histórico (`contarComoNaoLida: false`) não desarquiva nada.
      ...(contarComoNaoLida
        ? { naoLidas: { increment: 1 }, arquivada: false, atualizadoEm: new Date() }
        : {}),
    },
  });
}
