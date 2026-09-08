import { prisma } from "@/lib/prisma";
import { chamarGraph } from "@/lib/integracoes/meta";
import { contaConectada } from "@/lib/integracoes/whatsapp-oficial";
import { paraNomeadas, quantidadeNumeradas, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { statusDaMeta, type BotaoTemplate } from "./regras";

/**
 * Mantém a tabela `Template` em dia com o que existe na Meta.
 *
 * Duas coisas acontecem aqui, e as duas existem por causa de gente que cria modelo direto no
 * WhatsApp Manager (fora do CRM):
 *
 * 1. Puxa a lista da Graph e atualiza o espelho `WhatsappTemplate`. É o que já existia.
 * 2. Todo espelho que ainda não tem um `Template` do CRM ganha um, com o corpo convertido pra
 *    variáveis nomeadas (`{{1}}` → `{{var1}}`) e os botões lidos dos `components`. Sem isto, um
 *    modelo aprovado no Manager não apareceria na tela de Templates nem no Disparo em massa, e a
 *    pessoa acharia que precisa criar de novo.
 *
 * O status do `Template` ligado a um espelho sempre vem do espelho: quem decide se está aprovado
 * é a Meta, e o webhook `message_template_status_update` atualiza o espelho sozinho.
 */
type TemplateGraph = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: unknown;
};

type ComponenteMeta = {
  type?: string;
  text?: string;
  buttons?: { type?: string; text?: string }[];
};

export function corpoDoEspelho(componentes: unknown): string {
  if (!Array.isArray(componentes)) return "";
  return (componentes as ComponenteMeta[]).find((c) => c.type?.toUpperCase() === "BODY")?.text ?? "";
}

export function botoesDoEspelho(componentes: unknown): BotaoTemplate[] {
  if (!Array.isArray(componentes)) return [];
  const bloco = (componentes as ComponenteMeta[]).find((c) => c.type?.toUpperCase() === "BUTTONS");
  return (bloco?.buttons ?? [])
    .filter((b) => b.type?.toUpperCase() === "QUICK_REPLY" && b.text)
    .map((b) => ({ texto: b.text! }));
}

/** Variáveis genéricas (`var1`, `var2`…) pra um corpo numerado vindo da Meta: não dá pra saber
 * o que `{{1}}` significa, então fica como texto a preencher na hora do disparo. */
export function variaveisDoEspelho(corpoNumerado: string): MapeamentoVariavel[] {
  const total = quantidadeNumeradas(corpoNumerado);
  return Array.from({ length: total }, (_, i) => ({ chave: `var${i + 1}`, indice: i + 1, origem: "texto" as const }));
}

export async function sincronizarTemplatesMeta(workspaceId: string): Promise<void> {
  const conta = await contaConectada(workspaceId);
  if (conta?.wabaId) {
    try {
      const resposta = await chamarGraph<{ data?: TemplateGraph[] }>(
        `/${conta.wabaId}/message_templates?fields=id,name,language,category,status,components&limit=100`,
        conta.accessToken,
      );
      for (const t of resposta.data ?? []) {
        await prisma.whatsappTemplate.upsert({
          where: { workspaceId_metaId: { workspaceId, metaId: t.id } },
          create: {
            id: `template-${workspaceId}-${t.id}`,
            workspaceId,
            metaId: t.id,
            wabaId: conta.wabaId,
            nome: t.name,
            idioma: t.language,
            categoria: t.category,
            status: t.status,
            componentes: (t.components ?? []) as never,
          },
          update: {
            nome: t.name,
            idioma: t.language,
            categoria: t.category,
            status: t.status,
            componentes: (t.components ?? []) as never,
          },
        });
      }
    } catch (erro) {
      console.error("[templates] falha ao sincronizar com a Graph:", erro instanceof Error ? erro.message : erro);
    }
  }

  // Espelhos sem Template do CRM viram Template; os que já têm recebem o status atual da Meta.
  const espelhos = await prisma.whatsappTemplate.findMany({ where: { workspaceId } });
  if (!espelhos.length) return;
  const ligados = await prisma.template.findMany({
    where: { workspaceId, whatsappTemplateId: { in: espelhos.map((e) => e.id) } },
    select: { id: true, whatsappTemplateId: true, status: true },
  });
  const ligadoPorEspelho = new Map(ligados.map((l) => [l.whatsappTemplateId!, l]));

  for (const espelho of espelhos) {
    const status = statusDaMeta(espelho.status);
    const ligado = ligadoPorEspelho.get(espelho.id);
    if (ligado) {
      if (ligado.status !== status) {
        await prisma.template.update({
          where: { id: ligado.id },
          data: { status, motivoRejeicao: status === "rejeitado" ? espelho.motivoRejeicao : null },
        });
      }
      continue;
    }
    const corpoNumerado = corpoDoEspelho(espelho.componentes);
    const variaveis = variaveisDoEspelho(corpoNumerado);
    await prisma.template.create({
      data: {
        id: `tpl-${workspaceId}-${espelho.metaId}`,
        workspaceId,
        nome: espelho.nome,
        canal: "whatsapp_oficial",
        categoria: espelho.categoria,
        idioma: espelho.idioma,
        corpo: paraNomeadas(corpoNumerado, variaveis),
        variaveis: variaveis as never,
        botoes: botoesDoEspelho(espelho.componentes) as never,
        status,
        motivoRejeicao: espelho.motivoRejeicao,
        whatsappTemplateId: espelho.id,
      },
    });
  }
}
