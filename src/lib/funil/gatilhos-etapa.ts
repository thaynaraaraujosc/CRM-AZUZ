import { prisma } from "@/lib/prisma";
import { avaliarGrupoCondicoes } from "@/lib/automation-flow/motor";
import { iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import {
  dentroDaJanelaDoGatilho,
  quandoAceitos,
  QUANDO_ROTULO,
  type GatilhoEtapaVisao,
  type QuandoGatilho,
} from "./gatilhos-etapa-tipos";

export { dentroDaJanelaDoGatilho, QUANDO_ROTULO };
export type { GatilhoEtapaVisao, QuandoGatilho };

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
 * Executa os robôs que a etapa pediu. Chamado depois de o card já estar na etapa nova.
 *
 * Erros de um gatilho não derrubam os outros: uma automação com problema não pode impedir a
 * seguinte de rodar, e o card já se moveu de qualquer jeito.
 */
export async function dispararGatilhosDaEtapa(params: {
  workspaceId: string;
  etapaId: string;
  contatoNome: string;
  evento: "movido" | "criado" | "responsavel_alterado";
  /** Trava contra disparo repetido, por gatilho. */
  chaveEvento?: string;
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

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId: params.workspaceId, nome: params.contatoNome } },
  });
  const contato = {
    ...(contatoNoBanco ?? {}),
    nome: params.contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    canal: "crm",
    mensagem: "",
  };

  for (const linha of linhas) {
    if (!dentroDaJanelaDoGatilho(linha as unknown as GatilhoEtapaVisao, agora)) continue;

    // "Para todos os leads com:" do Kommo. Sem condição, vale pra todo lead que entrar.
    const condicao = comoGrupo(linha.condicao);
    if (condicao && !avaliarGrupoCondicoes(condicao, contato)) continue;

    const fluxo = await prisma.fluxoAutomacao.findFirst({
      where: { id: linha.fluxoId, workspaceId: params.workspaceId, arquivada: false },
    });
    if (!fluxo) {
      console.warn(`[gatilho-etapa] ${linha.id} aponta pro robô ${linha.fluxoId}, que não existe mais`);
      continue;
    }

    await iniciarFluxoComEstado({
      workspaceId: params.workspaceId,
      fluxoId: fluxo.id,
      gatilho: `etapa:${linha.quando}`,
      configuracoes: fluxo.configuracoes as never,
      publicarSeFaltar: {
        versao: Math.max(1, Number(fluxo.versaoAtual ?? 1)),
        nodes: fluxo.nodes as never,
        edges: fluxo.edges as never,
        configuracoes: fluxo.configuracoes as never,
      },
      contatoNome: params.contatoNome,
      contatoId: contatoNoBanco?.id ?? null,
      contato,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] robô ${fluxo.id} falhou:`, erro);
    });

    await prisma.fluxoAutomacao
      .update({ where: { id: fluxo.id }, data: { execucoes: { increment: 1 } } })
      .catch(() => {});
  }
}
