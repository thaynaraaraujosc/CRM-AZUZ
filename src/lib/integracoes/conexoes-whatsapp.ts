import { prisma } from "@/lib/prisma";
import { CANAL_NAO_OFICIAL } from "@/lib/integracoes/conta-canal";

/**
 * VÁRIOS NÚMEROS DE WHATSAPP NA MESMA EMPRESA.
 *
 * O CRM nasceu com um número por conta: uma instância na Evolution chamada `crm-<empresa>`, uma
 * linha em `Integracao`, uma caixa de entrada. Quem vende com equipe não trabalha assim — a
 * vendedora tem o número dela, o closer tem o dele, e os dois precisam cair no mesmo CRM sem que
 * as conversas se misturem nem que uma resposta saia pelo número errado.
 *
 * A coluna `slot` (1 a 10) é o que separa as conexões. O slot 1 é o número que já estava lá e
 * continua se chamando `crm-<empresa>` na Evolution — ninguém precisa ler QR de novo por causa
 * desta mudança.
 *
 * ESTE ARQUIVO É O ÚNICO LUGAR QUE RESPONDE "DE QUAL CONEXÃO É ISTO?". A pergunta aparece em todo
 * canto (webhook que recebe, tela que responde, automação que dispara), e cada lugar respondendo
 * do seu jeito é como uma resposta acaba saindo pelo número errado — que é o pior defeito possível
 * aqui: o cliente vê uma conversa começar num número e continuar em outro.
 */

/** Quantos números uma empresa pode conectar. Dez é o que a Thaynara pediu; o teto existe porque
 *  cada número é uma instância de pé na Evolution, e não um registro de graça no banco. */
export const LIMITE_DE_NUMEROS = 10;

export type ConexaoWhats = {
  slot: number;
  /** O número conectado, só dígitos, como a Evolution devolve. Nulo enquanto o QR não foi lido. */
  numero: string | null;
  /** O nome que a empresa deu ("Vendas — Marina"). Nulo quando ninguém nomeou ainda. */
  apelido: string | null;
  status: string;
  erroMensagem: string | null;
  qrDataUrl: string | null;
  atualizadoEm: Date | null;
};

function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** O número que vem depois do `:` em `whatsapp_nao_oficial:5562...`. Vazio quando não há. */
export function numeroDaContaCanal(contaCanal: string | null | undefined): string {
  if (!contaCanal) return "";
  const corte = contaCanal.indexOf(":");
  return corte < 0 ? "" : soDigitos(contaCanal.slice(corte + 1));
}

/** O primeiro slot livre, ou `null` quando a empresa já bateu no teto. */
export function proximoSlotLivre(ocupados: number[], limite = LIMITE_DE_NUMEROS): number | null {
  for (let slot = 1; slot <= limite; slot += 1) {
    if (!ocupados.includes(slot)) return slot;
  }
  return null;
}

/**
 * DE QUAL CONEXÃO É ESTA CONVERSA? É esta a pergunta que faz a resposta sair pelo número certo.
 *
 * Três respostas, e a terceira é a que importa:
 *
 * 1. O número gravado na conversa bate com o de uma conexão → é ela. É o caso normal.
 * 2. Não bate com nenhuma, mas a empresa só tem UMA conexão → é ela. Aqui mora a compatibilidade:
 *    conversa antiga sem marca, e conexão ligada cujo número o CRM não chegou a descobrir (acontece
 *    de verdade), continuam funcionando exatamente como funcionavam antes desta coluna existir.
 * 3. Não bate com nenhuma e existe mais de uma conexão → `null`, e quem chamou NÃO DEVE CHUTAR.
 *    Chutar aqui é mandar a resposta da cliente de um vendedor pelo número de outro, no meio de uma
 *    negociação. Melhor não enviar e dizer por quê do que enviar pelo lugar errado.
 */
export function slotDaConversa(
  conexoes: Pick<ConexaoWhats, "slot" | "numero">[],
  contaCanal: string | null | undefined,
): number | null {
  const numero = numeroDaContaCanal(contaCanal);
  if (numero) {
    const achada = conexoes.find((c) => soDigitos(c.numero) === numero);
    if (achada) return achada.slot;
  }
  if (conexoes.length === 1) return conexoes[0].slot;
  return null;
}

/** Como a conexão se chama na tela. O apelido manda; sem ele, o número; sem os dois, a posição. */
export function nomeDaConexao(conexao: Pick<ConexaoWhats, "slot" | "numero" | "apelido">): string {
  const apelido = conexao.apelido?.trim();
  if (apelido) return apelido;
  if (conexao.numero?.trim()) return formatarNumeroConectado(conexao.numero);
  return `Número ${conexao.slot}`;
}

/**
 * O número conectado, legível.
 *
 * A Evolution devolve `5562939614730` e isso aparecia cru na tela. Com um número a pessoa
 * reconhecia o dela assim mesmo; com dez, lado a lado, uma sequência de treze dígitos é o jeito
 * mais rápido de alguém desconectar o número errado.
 */
export function formatarNumeroConectado(numero: string | null | undefined): string {
  const digitos = soDigitos(numero);
  if (!digitos) return "";
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    const ddd = digitos.slice(2, 4);
    const resto = digitos.slice(4);
    const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
    const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
    return `+55 (${ddd}) ${meio}-${fim}`;
  }
  return `+${digitos}`;
}

/** `contaCanal` desta conexão: o que vai gravado em cada conversa e mensagem dela. */
export function contaCanalDaConexaoWhats(conexao: Pick<ConexaoWhats, "numero">): string | null {
  const digitos = soDigitos(conexao.numero);
  return digitos ? `${CANAL_NAO_OFICIAL}:${digitos}` : null;
}

function daLinha(linha: {
  slot: number;
  status: string;
  erroMensagem: string | null;
  atualizadoEm: Date | null;
  metadados: unknown;
}): ConexaoWhats {
  const metadados = (linha.metadados as Record<string, unknown> | null) ?? {};
  return {
    slot: linha.slot,
    numero: (metadados.numero as string | null) ?? null,
    apelido: (metadados.apelido as string | null) ?? null,
    status: linha.status,
    erroMensagem: linha.erroMensagem,
    qrDataUrl: (metadados.qrDataUrl as string | null) ?? null,
    atualizadoEm: linha.atualizadoEm,
  };
}

/** Todas as conexões de QR Code da empresa, na ordem dos slots. Inclui as desconectadas: elas
 *  continuam ocupando posição e é delas que sai o botão "Conectar" de novo. */
export async function listarConexoesWhats(workspaceId: string): Promise<ConexaoWhats[]> {
  const linhas = await prisma.integracao.findMany({
    where: { workspaceId, provedor: CANAL_NAO_OFICIAL },
    select: { slot: true, status: true, erroMensagem: true, atualizadoEm: true, metadados: true },
    orderBy: { slot: "asc" },
  });
  return linhas.map(daLinha);
}

/** Só as que estão de pé agora. É contra esta lista que se decide por onde uma resposta sai. */
export async function conexoesLigadas(workspaceId: string): Promise<ConexaoWhats[]> {
  const todas = await listarConexoesWhats(workspaceId);
  return todas.filter((c) => c.status === "conectado");
}

/**
 * O slot por onde esta conversa deve responder, lido do banco.
 *
 * Decide contra as conexões LIGADAS, e não contra todas: responder por um número desconectado não
 * é responder, é enfileirar erro na Evolution.
 */
export async function slotDeEnvio(workspaceId: string, contaCanal: string | null | undefined) {
  const ligadas = await conexoesLigadas(workspaceId);
  if (!ligadas.length) return { slot: null as number | null, motivo: "nenhum número de WhatsApp conectado" };
  const slot = slotDaConversa(ligadas, contaCanal);
  if (slot === null) {
    return {
      slot: null as number | null,
      motivo:
        "o número que recebeu essa conversa não está conectado agora. Com mais de um número na conta, o CRM não escolhe outro por conta própria: a conversa continuaria do lado do cliente vinda de um número diferente.",
    };
  }
  return { slot, motivo: undefined };
}

/**
 * O número por onde SAI uma conversa que ainda não existe.
 *
 * `slotDeEnvio` se recusa a escolher quando a conversa não diz de quem é, e é certo: responder uma
 * negociação pelo número errado é pior do que não responder. Mas iniciar é outra pergunta — o robô
 * que fala com quem nunca escreveu, a campanha que sai pra uma lista. Aí não existe "o número que
 * recebeu", e não escolher seria desligar o recurso em toda conta com mais de um número.
 *
 * A escolha é o primeiro número conectado, o de menor posição. É previsível (não muda sozinha de
 * um envio pro outro) e é a posição 1 nas contas de hoje, que é o número que já fazia isso.
 */
export async function slotPadraoDeEnvio(workspaceId: string): Promise<number | null> {
  const ligadas = await conexoesLigadas(workspaceId);
  return ligadas.length ? Math.min(...ligadas.map((c) => c.slot)) : null;
}

/** O id da linha de `Integracao` de cada conexão. O slot 1 mantém o id antigo pra não duplicar a
 *  linha que já existe nas contas de hoje. */
export function idDaConexao(workspaceId: string, slot: number): string {
  return slot <= 1 ? `${workspaceId}-${CANAL_NAO_OFICIAL}` : `${workspaceId}-${CANAL_NAO_OFICIAL}-${slot}`;
}
