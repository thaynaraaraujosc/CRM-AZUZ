import { prisma } from "@/lib/prisma";

/**
 * A LISTA DE FORMULÁRIOS QUE EXISTEM NO AZUZ FLOW.
 *
 * O CRM não tem como perguntar ao Flow quais formulários a agência montou: o tráfego entre os dois
 * é de mão única por decisão explícita do Flow — ele chama o CRM, o CRM nunca chama ele, e o
 * comentário de `endereco.ts` lá explica por quê (um campo de endereço no Flow seria um endereço
 * que o servidor dele visita a pedido de quem digitou, que é o jeito clássico de roubar segredo).
 *
 * Então é o FLOW QUE MANDA A LISTA, pela mesma chave e na mesma direção que já funcionam. Nenhuma
 * credencial nova, nenhum endereço novo, nenhuma porta aberta a mais.
 *
 * Até aqui, o CRM só ficava sabendo que um formulário existia quando chegava um lead dele — e era
 * exatamente o relato: "conecto e só vem um formulário, queria que aparecessem todos". Um
 * formulário recém-criado, ou um que ainda não foi preenchido por ninguém, não existia para o CRM
 * e portanto não dava para preparar robô nenhum pra ele.
 *
 * Mora em `Preferencia` (workspaceId + chave + JSON), igual ao resto da configuração do Flow: é
 * uma lista pequena que muda inteira a cada sincronização, não um cadastro com vida própria. Uma
 * tabela nova aqui seria uma migração para guardar o que cabe num campo.
 */

const CHAVE = "azuz-flow-formularios";

/** Teto de formulários guardados. Protege a coluna JSON de uma lista absurda vinda de fora. */
const MAX_FORMULARIOS = 300;

const LIMITES = { id: 190, nome: 200 } as const;

export type FormularioDoFlow = {
  id: string;
  nome: string;
  /** Publicado no Flow? Um rascunho não recebe resposta, e a tela diz isso em vez de escondê-lo. */
  publicado: boolean;
  /**
   * ESTE FORMULÁRIO ESTÁ LIGADO AO CRM, lá no Flow?
   *
   * É o campo que responde à pergunta que trouxe esta tela a existir: "conectei e só veio um
   * formulário". No Flow, "enviar ao CRM" é um liga/desliga DE CADA FORMULÁRIO
   * (`formularioEnviaAoCrm`, em `lib/crm/entrega-servidor.ts` lá) — conectar a agência não conecta
   * os formulários dela, um por um.
   *
   * Sem este campo, um formulário desligado apareceria aqui igual aos outros e a pessoa montaria
   * um robô que nunca dispara, sem nada na tela explicando por quê.
   */
  enviaAoCrm: boolean;
};

export type ListaDeFormularios = {
  formularios: FormularioDoFlow[];
  /** Quando o Flow mandou esta lista pela última vez. `null` = nunca mandou. */
  sincronizadaEm: string | null;
};

export const LISTA_VAZIA: ListaDeFormularios = { formularios: [], sincronizadaEm: null };

function texto(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, limite) : null;
}

/**
 * Lê o que veio de fora (ou do banco) com desconfiança, e devolve só o que tem forma de lista.
 *
 * Pura, pra ser provada sem banco. A regra é a mesma do resto da integração: CORTAR, NÃO RECUSAR.
 * Um formulário com nome de 500 caracteres não pode invalidar a lista inteira e deixar a agência
 * sem nenhum formulário na tela; ele entra aparado. Só entrada sem id nenhum é descartada, porque
 * sem id não há a que prender um robô.
 */
export function lerListaDeFormularios(dados: unknown): ListaDeFormularios {
  if (typeof dados !== "object" || dados === null) return LISTA_VAZIA;
  const bruto = dados as Record<string, unknown>;
  const lista = Array.isArray(bruto.formularios) ? bruto.formularios : [];

  const vistos = new Set<string>();
  const formularios: FormularioDoFlow[] = [];
  for (const item of lista) {
    if (typeof item !== "object" || item === null) continue;
    const linha = item as Record<string, unknown>;
    const id = texto(linha.id, LIMITES.id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    formularios.push({
      id,
      // Sem nome, o id: a tela precisa escrever ALGUMA coisa, e o id é verdade enquanto o nome é
      // palpite. Nome inventado seria pior do que um identificador feio.
      nome: texto(linha.nome, LIMITES.nome) ?? id,
      publicado: linha.publicado === true,
      enviaAoCrm: linha.enviaAoCrm === true,
    });
    if (formularios.length >= MAX_FORMULARIOS) break;
  }

  const sincronizadaEm = typeof bruto.sincronizadaEm === "string" ? bruto.sincronizadaEm : null;
  return { formularios, sincronizadaEm };
}

/** A lista guardada desta empresa. Vazia quando o Flow ainda não mandou nenhuma. */
export async function formulariosDoFlow(workspaceId: string): Promise<ListaDeFormularios> {
  const linha = await prisma.preferencia
    .findUnique({ where: { workspaceId_chave: { workspaceId, chave: CHAVE } }, select: { dados: true } })
    .catch(() => null);
  return lerListaDeFormularios(linha?.dados);
}

/**
 * Guarda a lista que o Flow mandou, SUBSTITUINDO a anterior.
 *
 * Substituir e não mesclar: a lista é o retrato do que existe no Flow AGORA. Mesclando, um
 * formulário apagado lá ficaria para sempre na tela do CRM, e quem olhasse continuaria vendo uma
 * opção que não recebe resposta nenhuma — sem nunca entender por quê.
 */
export async function guardarFormulariosDoFlow(
  workspaceId: string,
  formularios: FormularioDoFlow[],
): Promise<ListaDeFormularios> {
  const lista: ListaDeFormularios = {
    formularios,
    sincronizadaEm: new Date().toISOString(),
  };
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    create: { workspaceId, chave: CHAVE, dados: lista as unknown as object },
    update: { dados: lista as unknown as object },
  });
  return lista;
}
