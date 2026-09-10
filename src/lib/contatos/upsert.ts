import { prisma } from "@/lib/prisma";
import { aoAtualizarContato, aoCriarContato } from "@/lib/automacoes/gatilhos-crm";
import { slugId } from "@/lib/ids";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import type { Contato } from "@/lib/data";

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
 * Upsert por `nome` dentro do workspace. Mesma semântica que `POST /api/contatos` já usava
 * (extraída pra cá pra ser reaproveitada também pelos webhooks do WhatsApp, ver
 * `criarContatoPeloWhatsAppSeNaoExistir` abaixo, em vez de duplicar a lógica de criação).
 */
export async function upsertContato(params: {
  workspaceId: string;
  nome: string;
  dados?: Partial<Contato> & Record<string, unknown>;
  origemPadrao?: string;
}) {
  const { workspaceId, nome, dados = {}, origemPadrao = "Salvo manualmente" } = params;

  const existente = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
  if (existente) {
    const atualizado = await prisma.contato.update({
      where: { workspaceId_nome: { workspaceId, nome } },
      data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
    });
    aoAtualizarContato({ workspaceId, contatoNome: nome, antes: existente, depois: atualizado });
    return atualizado;
  }
  // É por AQUI que quase todo lead de verdade entra: o webhook do WhatsApp/Instagram cria o contato
  // na primeira mensagem. Sem o disparo aqui, "Lead criado" valeria só pra quem fosse cadastrado à
  // mão: ou seja, quase nunca.
  const criado = await prisma.contato.create({
    data: {
      id: `${workspaceId}-${slugId(nome)}`,
      workspaceId,
      initials: iniciaisDe(nome),
      nome,
      origem: origemPadrao,
      etapa: "Novo",
      responsavel: "-",
      ultima: "Agora",
      valor: "-",
      ...dados,
      etiquetas: dados.etiquetas ?? undefined,
    },
  });
  aoCriarContato({ workspaceId, contatoNome: nome, contatoId: criado.id });
  return criado;
}

/**
 * Acha um Contato existente pelo telefone (comparação normalizada. Dígitos + correção do 9º
 * dígito BR, ver `normalizarTelefoneParaComparacao`), não pelo `contains` cru que os webhooks
 * usavam antes: `"(62) 99999-9999"` cadastrado à mão nunca batia com `"5562999999999"` vindo do
 * WhatsApp, mesmo sendo o mesmo número. O dataset de contatos por workspace é pequeno o bastante
 * pra comparar em memória em vez de precisar de uma coluna computada no banco.
 */
export async function encontrarContatoPorTelefone(workspaceId: string, telefone: string) {
  const normalizado = normalizarTelefoneParaComparacao(telefone);
  if (!normalizado) return null;

  // Só `id` e `whatsapp` na varredura, e a linha inteira APENAS do contato que bateu. A versão
  // anterior trazia todos os contatos do workspace inteiros. Inclusive `fotoUrl`, que guarda a
  // foto em base64: a cada mensagem recebida pelo WhatsApp. Com algumas centenas de contatos
  // isso eram megabytes saindo do banco por mensagem, pagos por gigabyte na Railway, pra achar
  // um telefone. Era a maior fonte de egress que sobrava depois do `304` nas telas.
  const candidatos = await prisma.contato.findMany({
    where: { workspaceId, whatsapp: { not: null } },
    select: { id: true, whatsapp: true },
  });
  const achado = candidatos.find((c) => c.whatsapp && normalizarTelefoneParaComparacao(c.whatsapp) === normalizado);
  if (!achado) return null;
  return prisma.contato.findUnique({ where: { id: achado.id } });
}

/** Identificador de grupo do WhatsApp (`<id>@g.us`, ou só os dígitos dele). Telefone brasileiro
 * com DDI tem 12-13 dígitos; id de grupo tem 15 ou mais e começa por `1203`. */
export function ehIdentificadorDeGrupo(valor: string | null | undefined): boolean {
  if (!valor) return false;
  if (valor.includes("@g.us")) return true;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length >= 15;
}

/**
 * Chamado pelos webhooks do WhatsApp (Meta oficial e Evolution API/QR Code) quando chega mensagem
 * de um número: cria o Contato automaticamente se ainda não existir (por telefone OU por nome já
 * casado com o perfil/número), preenchendo nome e WhatsApp direto do que a mensagem trouxe. Sem
 * isso, número novo virava só uma Conversa "órfã", nunca aparecendo na tela de Contatos até alguém
 * salvar manualmente.
 */
export async function criarContatoPeloWhatsAppSeNaoExistir(params: {
  workspaceId: string;
  nome: string;
  whatsapp: string;
}) {
  const { workspaceId, nome, whatsapp } = params;

  // Um grupo NÃO é um lead. O identificador de grupo do WhatsApp (`<id>@g.us`, 15+ dígitos, ex.:
  // `120363422457482263`) não é telefone de ninguém. Quando virava contato, aparecia na carteira
  // de clientes e no funil como "+120363422457482263", entulhando as duas telas com algo que nunca
  // deveria estar lá. A conversa do grupo continua existindo normalmente; só não gera contato.
  if (ehIdentificadorDeGrupo(whatsapp)) return null;

  const porTelefone = await encontrarContatoPorTelefone(workspaceId, whatsapp);
  if (porTelefone) return porTelefone;

  return upsertContato({
    workspaceId,
    nome,
    dados: { whatsapp, criadoVia: "whatsapp" },
    origemPadrao: "WhatsApp",
  });
}

/**
 * Equivalente do `criarContatoPeloWhatsAppSeNaoExistir` pro Direct: cria o Contato quando chega
 * mensagem de um @ que ainda não está na carteira. Casa primeiro pelo próprio @ (a chave estável
 * daquele canal) e só depois cai no nome, porque a pessoa pode ter sido cadastrada à mão antes com
 * o mesmo nome de exibição.
 */
export async function criarContatoPeloInstagramSeNaoExistir(params: {
  workspaceId: string;
  nome: string;
  instagram: string;
  /** IGSID de quem mandou. A chave estável do canal: ver `encontrarContatoDoInstagram`. */
  instagramId?: string;
}) {
  const { workspaceId, nome, instagram, instagramId } = params;

  const existente = await encontrarContatoDoInstagram({ workspaceId, arroba: instagram, instagramId });
  if (existente) return existente;

  return upsertContato({
    workspaceId,
    nome,
    dados: { instagram, instagramId, criadoVia: "instagram" },
    origemPadrao: "Instagram",
  });
}

/**
 * Acha a pessoa do Direct, na ordem certa: IGSID primeiro, @ depois.
 *
 * O @ muda. A pessoa troca o nome de usuário e, deduplicando só por ele, ela volta a entrar como
 * lead NOVO: card novo no funil, histórico partido em dois, e o vendedor falando com alguém que
 * ele já conhece sem saber disso. O IGSID não muda enquanto a conta existir, e é por isso que ele
 * é o primeiro a ser consultado.
 *
 * Quando o casamento acontece pelo @ (contato antigo, gravado antes desta coluna existir), o IGSID
 * é preenchido ali mesmo. Assim a próxima mensagem já cai no caminho estável, e a base se conserta
 * sozinha conforme as pessoas voltam a escrever, sem migração.
 */
export async function encontrarContatoDoInstagram(params: {
  workspaceId: string;
  arroba?: string | null;
  instagramId?: string | null;
}) {
  const { workspaceId, arroba, instagramId } = params;

  if (instagramId) {
    const porId = await prisma.contato.findFirst({ where: { workspaceId, instagramId } });
    if (porId) return porId;
  }

  const porArroba = arroba ? await encontrarContatoPorInstagram(workspaceId, arroba) : null;
  if (porArroba && instagramId && !porArroba.instagramId) {
    // Conserta em silêncio: da próxima vez esta pessoa é achada pela chave que não muda.
    return prisma.contato.update({ where: { id: porArroba.id }, data: { instagramId } });
  }
  return porArroba;
}

/** Busca por @ do Instagram ignorando arroba e caixa. "@Fulana" e "fulana" são a mesma pessoa. */
export async function encontrarContatoPorInstagram(workspaceId: string, arroba: string) {
  const alvo = arroba.replace(/^@/, "").trim().toLowerCase();
  if (!alvo) return null;

  // Mesma regra de `encontrarContatoPorTelefone`: varre leve, carrega inteiro só o que bateu.
  const candidatos = await prisma.contato.findMany({
    where: { workspaceId, instagram: { not: null } },
    select: { id: true, instagram: true },
  });
  const achado = candidatos.find((c) => c.instagram?.replace(/^@/, "").trim().toLowerCase() === alvo);
  if (!achado) return null;
  return prisma.contato.findUnique({ where: { id: achado.id } });
}
