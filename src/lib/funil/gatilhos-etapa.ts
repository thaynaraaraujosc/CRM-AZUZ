import { prisma } from "@/lib/prisma";
import { avaliarGrupoCondicoes } from "@/lib/automation-flow/motor";
import { iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import {
  ACAO_ROTULO,
  dentroDaJanelaDoGatilho,
  quandoAceitos,
  QUANDO_ROTULO,
  type AcaoDados,
  type GatilhoEtapaVisao,
  type QuandoGatilho,
  type TipoAcaoGatilho,
} from "./gatilhos-etapa-tipos";
import { acoesReais } from "@/lib/automacoes/acoes";

export { ACAO_ROTULO, dentroDaJanelaDoGatilho, QUANDO_ROTULO };
export type { AcaoDados, GatilhoEtapaVisao, QuandoGatilho, TipoAcaoGatilho };

/**
 * Gatilhos que moram na ETAPA do funil, não dentro do fluxo.
 *
 * A automação passa a ser vista de onde ela acontece. Olhando o quadro do funil dá pra saber
 * quais etapas fazem alguma coisa sozinhas, quais robôs elas executam e em que horário, sem abrir
 * automação por automação. O fluxo vira um robô reutilizável: várias etapas podem executar o
 * mesmo.
 *
 * Convive com o gatilho de dentro do fluxo. Os fluxos que já existem continuam disparando pelo
 * bloco de gatilho deles, e desligar um não desliga o outro.
 */

function comoGrupo(valor: unknown): GrupoCondicoes | null {
  if (!valor || typeof valor !== "object") return null;
  const grupo = valor as GrupoCondicoes;
  return Array.isArray(grupo.regras) || Array.isArray(grupo.subgrupos) ? grupo : null;
}


/**
 * Executa uma ação DIRETA da etapa. Sem robô no meio.
 *
 * Reaproveita as mesmas ações do motor de automação de propósito: mudar o responsável a partir da
 * etapa tem que fazer exatamente o que o bloco "Alterar responsável" faz dentro de um fluxo. Duas
 * implementações da mesma coisa divergem na primeira correção feita só de um lado.
 */
async function executarAcaoDireta(params: {
  workspaceId: string;
  contatoNome: string;
  funilId: string;
  tipo: TipoAcaoGatilho;
  dados: AcaoDados;
}): Promise<{ ok: boolean; detalhe: string }> {
  const acoes = acoesReais({ workspaceId: params.workspaceId });
  const { contatoNome, dados } = params;

  switch (params.tipo) {
    case "responsavel": {
      if (!dados.responsavel) return { ok: false, detalhe: "Gatilho sem responsável escolhido." };
      return acoes.salvarContato({ contatoNome, dados: { responsavel: dados.responsavel } });
    }

    case "etapa": {
      if (!dados.etapaDestinoId) return { ok: false, detalhe: "Gatilho sem etapa de destino." };
      // A etapa de destino vira título porque é assim que `moverEtapa` procura, e é o mesmo
      // caminho que o bloco do editor usa.
      const destino = await prisma.funilEtapa.findFirst({
        where: { id: dados.etapaDestinoId, workspaceId: params.workspaceId },
        select: { titulo: true, funilId: true },
      });
      if (!destino) return { ok: false, detalhe: "A etapa de destino não existe mais." };
      return acoes.moverEtapa({ contatoNome, funilId: destino.funilId, etapaTitulo: destino.titulo });
    }

    case "etiquetas": {
      const contato = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId: params.workspaceId, nome: contatoNome } },
      });
      const atuais = Array.isArray(contato?.etiquetas) ? (contato.etiquetas as string[]) : [];
      const remover = new Set(dados.etiquetasRemover ?? []);
      const finais = [...new Set([...atuais.filter((e) => !remover.has(e)), ...(dados.etiquetasAdicionar ?? [])])];
      return acoes.salvarContato({ contatoNome, dados: { etiquetas: finais } });
    }

    case "tarefa": {
      if (!dados.tarefaTitulo?.trim()) return { ok: false, detalhe: "Gatilho sem título de tarefa." };
      const dias = Number(dados.tarefaPrazoDias ?? 0);
      const prazo = new Date();
      if (dias > 0) prazo.setDate(prazo.getDate() + dias);
      return acoes.criarTarefa({
        contatoNome,
        titulo: dados.tarefaTitulo,
        responsavel: dados.tarefaResponsavel,
        prazo,
      });
    }

    case "webhook": {
      if (!dados.webhookUrl?.trim()) return { ok: false, detalhe: "Gatilho sem endereço de webhook." };
      return acoes.chamarWebhook({
        url: dados.webhookUrl,
        corpo: { contato: contatoNome, funilId: params.funilId, origem: "gatilho-de-etapa" },
      });
    }

    case "mensagem": {
      if (!dados.mensagemTexto?.trim()) return { ok: false, detalhe: "Gatilho sem texto de mensagem." };
      return acoes.enviarTexto({ contatoNome, texto: dados.mensagemTexto });
    }

    default:
      return { ok: false, detalhe: `Ação "${params.tipo}" não é uma ação direta.` };
  }
}

/**
 * Executa o que a etapa pediu. Chamado depois de o card já estar na etapa nova.
 *
 * Erros de um gatilho não derrubam os outros: uma automação com problema não pode impedir a
 * seguinte de rodar, e o card já se moveu de qualquer jeito.
 */
export async function dispararGatilhosDaEtapa(params: {
  workspaceId: string;
  etapaId: string;
  contatoNome: string;
  evento: "movido" | "criado" | "responsavel_alterado";
  agora?: Date;
}): Promise<void> {
  const agora = params.agora ?? new Date();
  const linhas = await prisma.gatilhoEtapa.findMany({
    where: {
      workspaceId: params.workspaceId,
      etapaId: params.etapaId,
      ativo: true,
      quando: { in: quandoAceitos(params.evento) },
    },
    orderBy: { ordem: "asc" },
  });
  if (!linhas.length) return;

  for (const linha of linhas) {
    // Aqui a janela VALE: o lead entrou na etapa fora do horário em que a pessoa quis automatizar.
    if (!dentroDaJanelaDoGatilho(linha as unknown as GatilhoEtapaVisao, agora)) continue;
    await executarUmGatilho({
      workspaceId: params.workspaceId,
      contatoNome: params.contatoNome,
      gatilho: linha,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] ${linha.id} falhou:`, erro);
      return false;
    });
  }
}

/** A linha do banco, como o executor precisa dela. */
type LinhaGatilho = {
  id: string;
  workspaceId: string;
  funilId: string;
  etapaId: string;
  quando: string;
  tipoAcao: string;
  fluxoId: string | null;
  acaoDados: unknown;
  condicao: unknown;
};

/**
 * Executa UM gatilho para UM lead. É o miolo compartilhado entre a entrada na etapa, o "aplicar
 * aos leads que já estão aqui" e a varredura diária: os três fazem exatamente a mesma coisa, e
 * três cópias divergiriam na primeira correção feita só numa delas.
 *
 * Devolve `false` quando o gatilho foi pulado (condição não bateu, robô sumiu, ação sem dados).
 */
async function executarUmGatilho(params: {
  workspaceId: string;
  contatoNome: string;
  gatilho: LinhaGatilho;
}): Promise<boolean> {
  const { workspaceId, contatoNome, gatilho } = params;

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
  });
  const contato = {
    ...(contatoNoBanco ?? {}),
    nome: contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    canal: "crm",
    mensagem: "",
  };

  // "Para todos os leads com:". Sem condição, vale pra todo lead.
  const condicao = comoGrupo(gatilho.condicao);
  if (condicao && !avaliarGrupoCondicoes(condicao, contato)) return false;

  const tipo = (gatilho.tipoAcao ?? "robo") as TipoAcaoGatilho;

  if (tipo !== "robo") {
    const resultado = await executarAcaoDireta({
      workspaceId,
      contatoNome,
      funilId: gatilho.funilId,
      tipo,
      dados: (gatilho.acaoDados as AcaoDados) ?? {},
    });
    if (!resultado.ok) {
      console.warn(`[gatilho-etapa] ${gatilho.id} (${ACAO_ROTULO[tipo]}): ${resultado.detalhe}`);
      return false;
    }
    return true;
  }

  if (!gatilho.fluxoId) {
    console.warn(`[gatilho-etapa] ${gatilho.id} é do tipo robô mas não tem robô escolhido`);
    return false;
  }
  const fluxo = await prisma.fluxoAutomacao.findFirst({
    where: { id: gatilho.fluxoId, workspaceId, arquivada: false },
  });
  if (!fluxo) {
    console.warn(`[gatilho-etapa] ${gatilho.id} aponta pro robô ${gatilho.fluxoId}, que não existe mais`);
    return false;
  }

  await iniciarFluxoComEstado({
    workspaceId,
    fluxoId: fluxo.id,
    gatilho: `etapa:${gatilho.quando}`,
    configuracoes: fluxo.configuracoes as never,
    publicarSeFaltar: {
      versao: Math.max(1, Number(fluxo.versaoAtual ?? 1)),
      nodes: fluxo.nodes as never,
      edges: fluxo.edges as never,
      configuracoes: fluxo.configuracoes as never,
    },
    contatoNome,
    contatoId: contatoNoBanco?.id ?? null,
    contato,
  });

  await prisma.fluxoAutomacao
    .update({ where: { id: fluxo.id }, data: { execucoes: { increment: 1 } } })
    .catch(() => {});
  return true;
}

/**
 * Roda UM gatilho nos leads que já estão na etapa dele.
 *
 * Serve a duas coisas: a caixinha "aplicar aos leads que já estão aqui", e a varredura diária
 * (o `quando = "diariamente"`), que é exatamente a mesma operação repetida todo dia no horário.
 *
 * A janela de dias/horário NÃO é checada aqui: quem aplica à mão está pedindo agora, e a
 * varredura diária já roda no horário que a própria pessoa escolheu.
 */
export async function rodarGatilhoNosLeadsDaEtapa(params: {
  workspaceId: string;
  gatilhoId: string;
  /** Teto de leads por chamada. Uma etapa com milhares não pode estourar o tempo da função. */
  limite?: number;
}): Promise<number> {
  const gatilho = await prisma.gatilhoEtapa.findFirst({
    where: { id: params.gatilhoId, workspaceId: params.workspaceId },
  });
  if (!gatilho) return 0;

  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId: params.workspaceId, etapaId: gatilho.etapaId },
    select: { nome: true },
    orderBy: { ordem: "asc" },
    take: params.limite ?? 200,
  });

  let alcancados = 0;
  for (const card of cards) {
    const feito = await executarUmGatilho({
      workspaceId: params.workspaceId,
      contatoNome: card.nome,
      gatilho,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] ${gatilho.id} falhou no lead ${card.nome}:`, erro);
      return false;
    });
    if (feito) alcancados++;
  }
  return alcancados;
}

/**
 * A varredura do `quando = "diariamente"`. Chamada pela batida do cron.
 *
 * Roda os gatilhos cuja hora já passou HOJE e que ainda não rodaram hoje. O controle é o
 * `criadoEm`/`ultimoDisparo`? Não: é a própria hora comparada com a batida, com uma janela de
 * tolerância do tamanho do intervalo do cron. Um gatilho marcado pras 12:00 dispara na primeira
 * batida a partir das 12:00, e não de novo, porque a janela já passou.
 */
export async function rodarGatilhosDiarios(agora: Date = new Date()): Promise<{ gatilhos: number; leads: number }> {
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const linhas = await prisma.gatilhoEtapa.findMany({
    where: { quando: "diariamente", ativo: true, horarioDiario: hora },
  });

  let leads = 0;
  for (const linha of linhas) {
    leads += await rodarGatilhoNosLeadsDaEtapa({
      workspaceId: linha.workspaceId,
      gatilhoId: linha.id,
    }).catch(() => 0);
  }
  return { gatilhos: linhas.length, leads };
}
