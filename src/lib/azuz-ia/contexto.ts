import { prisma } from "@/lib/prisma";

const LIMITE_REGISTROS = 30;

/**
 * Monta um recorte limitado e recente dos dados do workspace, só pras categorias marcadas em
 * "Dados permitidos" (Configurações → Azuz IA) — nunca o banco inteiro, pra manter o prompt (e o
 * custo da chamada à IA) sob controle. Cada categoria vira um bloco de texto compacto, não JSON
 * cru, pra facilitar o modelo ler.
 *
 * Limitação conhecida: "relatórios", "campanhas" e "documentos" (as outras 3 opções que já
 * existem na UI de "Dados permitidos") ainda não têm uma tabela 1:1 que dê pra virar contexto de
 * prompt de forma direta — ficam de fora por enquanto, sem efeito quando marcadas.
 */
export async function montarContextoWorkspace(workspaceId: string, dadosPermitidos: string[]): Promise<string> {
  const blocos: string[] = [];

  if (dadosPermitidos.includes("contatos")) {
    const contatos = await prisma.contato.findMany({
      where: { workspaceId },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_REGISTROS,
      select: { nome: true, origem: true, etapa: true, responsavel: true, valor: true, favorito: true },
    });
    if (contatos.length) {
      blocos.push(
        `### Contatos recentes (${contatos.length} mais recentes)\n` +
          contatos
            .map((c) => `- ${c.nome} · origem: ${c.origem} · etapa: ${c.etapa} · responsável: ${c.responsavel} · valor: ${c.valor}${c.favorito ? " · favorito" : ""}`)
            .join("\n"),
      );
    }
  }

  if (dadosPermitidos.includes("conversas")) {
    const mensagens = await prisma.mensagemExtra.findMany({
      where: { workspaceId },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_REGISTROS,
      select: { contato: true, tipo: true, texto: true, hora: true },
    });
    if (mensagens.length) {
      blocos.push(
        `### Mensagens recentes (${mensagens.length} mais recentes)\n` +
          mensagens.map((m) => `- [${m.hora}] ${m.contato} (${m.tipo === "in" ? "recebida" : "enviada"}): ${m.texto}`).join("\n"),
      );
    }
  }

  if (dadosPermitidos.includes("funis")) {
    const negocios = await prisma.negocioCard.findMany({
      where: { workspaceId },
      take: LIMITE_REGISTROS,
      include: { etapa: { include: { funil: true } } },
    });
    if (negocios.length) {
      blocos.push(
        `### Negócios em andamento no funil (${negocios.length})\n` +
          negocios
            .map((n) => `- ${n.nome} · funil: ${n.etapa.funil.nome} · etapa: ${n.etapa.titulo} · valor: ${n.valor} · origem: ${n.origem}`)
            .join("\n"),
      );
    }
  }

  if (dadosPermitidos.includes("tarefas")) {
    const tarefas = await prisma.tarefaCard.findMany({
      where: { workspaceId, concluida: false },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_REGISTROS,
      select: { titulo: true, contato: true, responsavelNome: true, urgencia: true, data: true, atrasada: true },
    });
    if (tarefas.length) {
      blocos.push(
        `### Tarefas em aberto (${tarefas.length})\n` +
          tarefas
            .map((t) => `- ${t.titulo} · contato: ${t.contato} · responsável: ${t.responsavelNome} · urgência: ${t.urgencia} · prazo: ${t.data}${t.atrasada ? " · ATRASADA" : ""}`)
            .join("\n"),
      );
    }
  }

  return blocos.join("\n\n");
}
