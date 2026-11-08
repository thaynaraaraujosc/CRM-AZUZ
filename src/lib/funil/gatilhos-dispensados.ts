import { prisma } from "@/lib/prisma";

/**
 * OS ROBÔS QUE A EMPRESA TIROU DA GRADE DE PROPÓSITO.
 *
 * O defeito que isto conserta, relatado em 08/11/2026: "apago a automação, ela some, e aí ele
 * tenta trazer de novo". Era exatamente o que acontecia, e a culpa era de a migração não ter
 * memória.
 *
 * A oferta "trazer pra grade" olha os fluxos que têm bloco de gatilho dentro do canvas e não têm
 * linha na grade do funil. Apagar o card da grade apaga a linha — e o bloco continua no canvas,
 * de propósito, pra dar como voltar atrás. Só que no instante seguinte o fluxo voltava a casar
 * com a descrição da oferta, e o aviso reaparecia propondo recriar o que acabara de ser apagado.
 * Um laço sem fim, e do pior tipo: um em que o produto parece ignorar o que a pessoa acabou de
 * mandar fazer.
 *
 * Apagar passa a ser uma DECISÃO REGISTRADA. "Apagou, apagou" — e a oferta nunca mais mexe
 * naquele fluxo.
 *
 * Mora em `Preferencia` (`workspaceId` + `chave` + JSON), que é onde o projeto já guarda escolha
 * de empresa sem pedir coluna nova. Uma coluna por ideia num banco com cliente em cima é o
 * caminho mais caro possível pra mudar um padrão — e aqui nem é dado de negócio: é a memória de
 * uma decisão sobre uma oferta de tela.
 */

const CHAVE = "funil:gatilhos-dispensados";

/** Teto: protege a coluna JSON de crescer sem limite num workspace com muitos fluxos. */
const MAXIMO = 500;

/**
 * Junta o que já estava guardado com o que acabou de ser dispensado, sem repetir.
 *
 * Pura porque é a parte que pode errar em silêncio: perder um id aqui devolve o laço do aviso, e
 * guardar lixo enche a coluna. Os dois sem erro em lugar nenhum.
 */
export function juntarDispensados(atuais: unknown, novos: string[]): string[] {
  const lista = Array.isArray(atuais) ? atuais.filter((x): x is string => typeof x === "string" && Boolean(x)) : [];
  const limpos = novos.filter((x) => typeof x === "string" && x.trim());
  const juntos = [...lista, ...limpos.map((x) => x.trim())];
  const semRepetir = juntos.filter((x, i) => juntos.indexOf(x) === i);
  // Corta pelo começo: o que foi dispensado há mais tempo é o que menos importa lembrar, porque
  // a oferta só reaparece pra fluxo que ainda existe e ainda tem bloco de gatilho dentro.
  return semRepetir.length > MAXIMO ? semRepetir.slice(semRepetir.length - MAXIMO) : semRepetir;
}

export async function fluxosDispensados(workspaceId: string): Promise<string[]> {
  const linha = await prisma.preferencia
    .findUnique({ where: { workspaceId_chave: { workspaceId, chave: CHAVE } }, select: { dados: true } })
    .catch(() => null);
  return juntarDispensados(linha?.dados, []);
}

/** Registra que estes fluxos foram tirados da grade a pedido de alguém. */
export async function dispensarFluxos(workspaceId: string, fluxoIds: string[]): Promise<void> {
  const novos = fluxoIds.filter(Boolean);
  if (!novos.length) return;
  const atuais = await fluxosDispensados(workspaceId);
  const dados = juntarDispensados(atuais, novos);
  await prisma.preferencia
    .upsert({
      where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
      create: { workspaceId, chave: CHAVE, dados },
      update: { dados },
    })
    // Falhar aqui não pode derrubar o apagar: o card já saiu da grade, que é o que foi pedido.
    // O pior que acontece é a oferta reaparecer — o defeito antigo —, e não um erro na cara.
    .catch((erro) => console.error("[gatilhos] falha ao lembrar do que foi apagado:", erro));
}
