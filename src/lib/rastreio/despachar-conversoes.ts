import type { PrismaClient } from "@/generated/prisma/client";
import { contaDoWorkspace } from "@/lib/integracoes/google-ads-conta";
import { enviarConversoes, garantirAcaoDeConversao } from "@/lib/integracoes/google-ads";
import { decriptar } from "@/lib/integracoes/crypto";
import { identificadoresDoContato } from "@/lib/rastreio/identificadores";
import { enviarConversoesMeta, resolverDataset } from "@/lib/integracoes/meta-conversoes";
import {
  conversoesPendentes,
  registrarTentativa,
  type ResultadoDoEnvio,
} from "@/lib/rastreio/fila-de-conversoes";

/**
 * A RODADA QUE CONVERSA COM AS PLATAFORMAS.
 *
 * Ela tira da fila o que está vencido, manda, e anota o que voltou. Nada aqui decide se uma
 * conversão DEVE ir: isso foi decidido na hora de enfileirar (ver `eventos-de-conversao.ts`), e
 * repetir a decisão aqui criaria duas respostas possíveis pra mesma pergunta.
 *
 * UMA LINHA POR VEZ, e não um lote por plataforma. O lote é mais barato em chamadas e mais caro em
 * tudo o mais: com cinco conversões num pedido e uma resposta de erro, não há como saber qual das
 * cinco a plataforma recusou — e aí ou todas repetem (e as quatro boas vão duas vezes) ou nenhuma
 * repete. O volume aqui é de dezenas por dia, não de milhares por minuto.
 */

const POR_RODADA = 40;

export async function despacharConversoes(
  prisma: PrismaClient,
  workspaceId: string,
  agora: Date = new Date(),
): Promise<{ enviadas: number; falhas: number }> {
  const pendentes = await conversoesPendentes(prisma, workspaceId, POR_RODADA, agora);
  if (!pendentes.length) return { enviadas: 0, falhas: 0 };

  let enviadas = 0;
  let falhas = 0;
  for (const linha of pendentes) {
    const resultado = await enviarUma(prisma, linha).catch(
      (erro): ResultadoDoEnvio => ({
        ok: false,
        erro: erro instanceof Error ? erro.message : "Falha inesperada no envio",
      }),
    );
    await registrarTentativa(prisma, linha.id, resultado, agora);
    if (resultado.ok) enviadas += 1;
    else falhas += 1;
  }
  return { enviadas, falhas };
}

/** A mesma rodada pra todo mundo que tem fila. Chamada pelo cron. */
export async function despacharEmTodosOsWorkspaces(
  prisma: PrismaClient,
  agora: Date = new Date(),
): Promise<{ workspaces: number; enviadas: number; falhas: number }> {
  const comFila = await prisma.eventoDeConversao.groupBy({
    by: ["workspaceId"],
    where: { status: "pendente", OR: [{ proximaEm: null }, { proximaEm: { lte: agora } }] },
  });
  let enviadas = 0;
  let falhas = 0;
  for (const { workspaceId } of comFila) {
    const r = await despacharConversoes(prisma, workspaceId, agora).catch((erro) => {
      console.error("[conversoes] rodada falhou:", { workspaceId, erro });
      return { enviadas: 0, falhas: 0 };
    });
    enviadas += r.enviadas;
    falhas += r.falhas;
  }
  return { workspaces: comFila.length, enviadas, falhas };
}

type LinhaDaFila = Awaited<ReturnType<typeof conversoesPendentes>>[number];

async function enviarUma(prisma: PrismaClient, linha: LinhaDaFila): Promise<ResultadoDoEnvio> {
  /*
   * OS IDENTIFICADORES SÃO LIDOS AGORA, e não guardados na fila.
   *
   * Eles são dado pessoal: copiá-los pra dentro de uma linha de histórico seria mantê-los num
   * lugar a mais, com outra retenção. Lendo na hora, a fila guarda só a decisão ("mandar a venda
   * do lead X pro Google") e o dado continua morando num lugar só — de onde ele some quando o
   * contato é apagado.
   */
  const contato = await prisma.contato.findUnique({
    where: { id: linha.contatoId },
    select: { email: true, whatsapp: true, origemDoLead: true },
  });
  if (!contato) {
    return { ok: false, erro: "O contato desta conversão não existe mais.", definitivo: true };
  }
  const origem = contato.origemDoLead;
  const valor = linha.valor ? Number(linha.valor) : 0;

  if (linha.plataforma === "meta") {
    const integracao = await prisma.integracao.findUnique({
      where: { workspaceId_provedor_slot: { workspaceId: linha.workspaceId, provedor: "meta_ads", slot: 1 } },
      select: { accessTokenCriptografado: true, metadados: true },
    });
    const adAccountId = (integracao?.metadados as { adAccountId?: string } | null)?.adAccountId;
    if (!integracao?.accessTokenCriptografado || !adAccountId) {
      return { ok: false, erro: "Meta Ads não está conectado neste workspace.", definitivo: true };
    }
    const accessToken = decriptar(integracao.accessTokenCriptografado);
    const dataset = linha.contaId
      ? { ok: true as const, dataset: { id: linha.contaId, nome: linha.contaId } }
      : await resolverDataset({ accessToken, adAccountId });
    if (!dataset.ok) return { ok: false, erro: dataset.erro };

    const envio = await enviarConversoesMeta({
      accessToken,
      datasetId: dataset.dataset.id,
      conversoes: [
        {
          ctwaClid: origem?.cliqueId ?? null,
          email: contato.email,
          telefone: contato.whatsapp,
          quando: linha.eventoEm,
          valor,
          // O id do evento é a chave de idempotência: se o pixel do site mandar a mesma compra, a
          // Meta entende que é o mesmo evento e conta uma vez.
          idDoNegocio: linha.chaveIdempotencia,
        },
      ],
    });
    return envio.ok
      ? { ok: true, resposta: `${envio.recebidos} evento(s) recebido(s)` }
      : { ok: false, erro: envio.erro };
  }

  if (linha.plataforma === "google") {
    const conta = await contaDoWorkspace(linha.workspaceId, prisma);
    if (!conta) {
      return { ok: false, erro: "Google Ads não está conectado neste workspace.", definitivo: true };
    }
    const acao = await garantirAcaoDeConversao(conta);
    if (!acao.ok) return { ok: false, erro: acao.erro };
    const envio = await enviarConversoes({
      accessToken: conta.accessToken,
      customerId: conta.customerId,
      acaoDeConversao: acao.resourceName,
      conversoes: [
        {
          cliqueId: origem?.cliqueId ?? null,
          tipoDoClique: origem?.tipoDoClique ?? null,
          quando: linha.eventoEm,
          valor,
          // E-mail e telefone embaralhados: é o que permite o Google reencontrar a pessoa quando
          // o código do clique não chegou. O dado cru nunca sai daqui.
          identificadores: identificadoresDoContato(contato),
          idDoNegocio: linha.chaveIdempotencia,
          consentimento: (origem?.consentimento as "concedido" | "negado" | null) ?? null,
        },
      ],
    });
    if (!envio.ok) return { ok: false, erro: envio.erro };
    // `partialFailure` ligado: a conversão pode ter sido recusada sozinha dentro de uma chamada
    // que respondeu 200. Tratar isso como sucesso seria o mesmo defeito que a fila existe pra
    // acabar — "enviado" sem nada ter chegado do outro lado.
    const recusa = envio.falhas[0];
    return recusa ? { ok: false, erro: recusa.erro, definitivo: true } : { ok: true, resposta: "Aceita pelo Google Ads" };
  }

  /*
   * TIKTOK E GA4 AINDA NÃO TÊM CONEXÃO NO CRM.
   *
   * A linha fica com falha DEFINITIVA e um motivo que diz exatamente isso, em vez de ficar
   * tentando cinco vezes contra uma integração que não existe. Quando elas entrarem, é aqui que
   * cada uma ganha o seu ramo — e as linhas paradas podem ser reprocessadas em lote.
   */
  return {
    ok: false,
    erro: `A integração com ${linha.plataforma === "tiktok" ? "o TikTok" : "o Google Analytics"} ainda não está disponível no CRM. A conversão ficou guardada e pode ser reenviada quando ela existir.`,
    definitivo: true,
  };
}
