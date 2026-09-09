import { prisma } from "@/lib/prisma";
import type { FlowNode, GatilhoEtapaData } from "@/lib/automation-flow/types";

/**
 * Traz os gatilhos que moram DENTRO dos fluxos para a tabela `GatilhoEtapa`.
 *
 * Existiam duas formas de dizer "esta automação roda nesta etapa": o bloco de gatilho no canvas e
 * a linha em `GatilhoEtapa` (a grade "Automatizar" do funil). Nada as conciliava, e um fluxo com
 * as duas disparava DUAS vezes pro mesmo lead.
 *
 * A lógica mora aqui, e não no script, porque dois lugares a chamam: o script de linha de comando
 * e o botão em Configurações. Duas cópias divergiriam na primeira correção feita só numa delas, e
 * essa é justamente a classe de problema que esta migração existe pra resolver.
 *
 * Nada é apagado. Os blocos de gatilho continuam no canvas: é o que permite voltar atrás.
 */

/** Que `quando` de `GatilhoEtapa` corresponde a cada bloco de gatilho do canvas. */
const QUANDO_POR_TIPO: Record<string, string> = {
  lead_criado: "criado",
  lead_entrou_etapa: "movido",
  responsavel_alterado: "responsavel_alterado",
};

export type ItemDaMigracao = {
  fluxoId: string;
  fluxoNome: string;
  tipoGatilho: string;
  etapaTitulo: string;
  quando: string;
  ativo: boolean;
};

export type ResultadoDaMigracao = {
  /** O que foi (ou seria) criado. */
  migrados: ItemDaMigracao[];
  /** Fluxos que já tinham gatilho de etapa. Nada foi duplicado. */
  jaTinham: number;
  /** Fluxos com gatilho de etapa mas SEM etapa escolhida: não dá pra saber qual, e não se inventa. */
  semEtapa: { fluxoId: string; fluxoNome: string }[];
};

/**
 * @param workspaceId Sempre da sessão de quem chamou, nunca do cliente. Um workspace não migra o
 *   funil de outro.
 * @param apenasSimular `true` devolve o que aconteceria sem gravar nada. É o `--contar`.
 */
export async function migrarGatilhosParaEtapa(params: {
  workspaceId: string;
  apenasSimular: boolean;
}): Promise<ResultadoDaMigracao> {
  const { workspaceId, apenasSimular } = params;

  const fluxos = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId, arquivada: false },
    select: { id: true, nome: true, nodes: true, etapaId: true, ativa: true },
  });

  const migrados: ItemDaMigracao[] = [];
  const semEtapa: { fluxoId: string; fluxoNome: string }[] = [];
  let jaTinham = 0;

  for (const fluxo of fluxos) {
    const nodes = (fluxo.nodes ?? []) as FlowNode[];
    const gatilho = Array.isArray(nodes) ? nodes.find((n) => n.category === "gatilho") : undefined;
    if (!gatilho) continue;

    const quando = QUANDO_POR_TIPO[gatilho.type];
    // Gatilho de conversa (mensagem, palavra-chave, comentário) não tem etapa a que se prender.
    // Continua disparando pelo bloco, como sempre.
    if (!quando) continue;

    // A etapa pode estar no bloco (o caso normal) ou no próprio fluxo (formato mais antigo).
    const dados = (gatilho.data ?? {}) as GatilhoEtapaData;
    const etapaId = dados.etapaId || fluxo.etapaId || null;
    if (!etapaId) {
      semEtapa.push({ fluxoId: fluxo.id, fluxoNome: fluxo.nome });
      continue;
    }

    const etapa = await prisma.funilEtapa.findFirst({
      where: { id: etapaId, workspaceId },
      select: { id: true, funilId: true, titulo: true },
    });
    if (!etapa) {
      semEtapa.push({ fluxoId: fluxo.id, fluxoNome: fluxo.nome });
      continue;
    }

    const existente = await prisma.gatilhoEtapa.findFirst({
      where: { workspaceId, etapaId: etapa.id, fluxoId: fluxo.id },
      select: { id: true },
    });
    if (existente) {
      jaTinham++;
      continue;
    }

    migrados.push({
      fluxoId: fluxo.id,
      fluxoNome: fluxo.nome,
      tipoGatilho: gatilho.type,
      etapaTitulo: etapa.titulo,
      quando,
      ativo: fluxo.ativa,
    });

    if (apenasSimular) continue;

    await prisma.gatilhoEtapa.create({
      data: {
        id: `gat-mig-${fluxo.id}`,
        workspaceId,
        funilId: etapa.funilId,
        etapaId: etapa.id,
        quando,
        tipoAcao: "robo",
        fluxoId: fluxo.id,
        // Herda o liga/desliga do fluxo: uma automação pausada não pode voltar a disparar só
        // porque o gatilho mudou de lugar.
        ativo: fluxo.ativa,
        ordem: 0,
      },
    });
  }

  return { migrados, jaTinham, semEtapa };
}
