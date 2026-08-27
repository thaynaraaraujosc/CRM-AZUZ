import { prisma } from "@/lib/prisma";
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
 * Upsert por `nome` dentro do workspace — mesma semântica que `POST /api/contatos` já usava
 * (extraída pra cá pra ser reaproveitada também pelos webhooks do WhatsApp, ver
 * `criarContatoPeloWhatsAppSeNaoExistir` abaixo, em vez de duplicar a lógica de criação).
 */
export async function upsertContato(params: {
  workspaceId: string;
  nome: string;
  dados?: Partial<Contato> & Record<string, unknown>;
  origemPadrao?: string;
}) {
  const { workspaceId, nome, dados = {}, origemPadrao = "Indicação" } = params;

  const existente = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
  if (existente) {
    return prisma.contato.update({
      where: { workspaceId_nome: { workspaceId, nome } },
      data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
    });
  }
  return prisma.contato.create({
    data: {
      id: `${workspaceId}-${slugId(nome)}`,
      workspaceId,
      initials: iniciaisDe(nome),
      nome,
      origem: origemPadrao,
      etapa: "Novo",
      responsavel: "—",
      ultima: "Agora",
      valor: "—",
      ...dados,
      etiquetas: dados.etiquetas ?? undefined,
    },
  });
}

/**
 * Acha um Contato existente pelo telefone (comparação normalizada — dígitos + correção do 9º
 * dígito BR, ver `normalizarTelefoneParaComparacao`), não pelo `contains` cru que os webhooks
 * usavam antes: `"(62) 99999-9999"` cadastrado à mão nunca batia com `"5562999999999"` vindo do
 * WhatsApp, mesmo sendo o mesmo número. O dataset de contatos por workspace é pequeno o bastante
 * pra comparar em memória em vez de precisar de uma coluna computada no banco.
 */
export async function encontrarContatoPorTelefone(workspaceId: string, telefone: string) {
  const normalizado = normalizarTelefoneParaComparacao(telefone);
  if (!normalizado) return null;

  const candidatos = await prisma.contato.findMany({
    where: { workspaceId, whatsapp: { not: null } },
  });
  return (
    candidatos.find((c) => c.whatsapp && normalizarTelefoneParaComparacao(c.whatsapp) === normalizado) ?? null
  );
}

/** Identificador de grupo do WhatsApp (`<id>@g.us`, ou só os dígitos dele). Telefone brasileiro
 * com DDI tem 12–13 dígitos; id de grupo tem 15 ou mais e começa por `1203`. */
export function ehIdentificadorDeGrupo(valor: string | null | undefined): boolean {
  if (!valor) return false;
  if (valor.includes("@g.us")) return true;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length >= 15;
}

/**
 * Chamado pelos webhooks do WhatsApp (Meta oficial e Evolution API/QR Code) quando chega mensagem
 * de um número — cria o Contato automaticamente se ainda não existir (por telefone OU por nome já
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
  // `120363422457482263`) não é telefone de ninguém — quando virava contato, aparecia na carteira
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
