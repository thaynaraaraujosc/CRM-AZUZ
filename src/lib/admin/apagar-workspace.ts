import type { PrismaClient } from "@/generated/prisma/client";

/**
 * APAGAR UMA EMPRESA INTEIRA DO CRM.
 *
 * Isto existe porque a maioria das contas do começo é de teste, e uma base cheia de conta de
 * teste faz todo número do painel mentir: MRR, usuários ativos, quantas empresas usam o produto.
 * A conta de teste não é um detalhe cosmético — ela é a razão de o painel dizer "4 assinaturas"
 * quando nada foi vendido.
 *
 * A ORDEM IMPORTA, e é por isso que ela está escrita e não deduzida. O MySQL recusa apagar uma
 * linha que ainda tem filho apontando pra ela: `Funil` antes de `FunilEtapa` falha, `Contato`
 * antes de `Conversa` falha. A lista abaixo vai do mais filho pro mais pai, e termina no próprio
 * workspace.
 *
 * E ELA SE DENUNCIA QUANDO ENVELHECE. Toda tabela nova com `workspaceId` precisa entrar aqui,
 * senão apagar uma empresa falha no meio — com parte dos dados já apagados. O teste
 * `apagar-workspace.test.ts` lê o `schema.prisma`, acha TODA tabela com `workspaceId` e exige que
 * ela esteja nesta lista: esquecer vira um teste vermelho com o nome da tabela, e não um erro em
 * produção no meio de uma exclusão.
 */

/**
 * As tabelas por `workspaceId`, de filho pra pai.
 *
 * Os nomes são os do cliente do Prisma (primeira letra minúscula), que é como eles são chamados
 * no código. O primeiro grupo é o que tem pai DENTRO do workspace; o segundo é o que só aponta
 * pro workspace e pode ir em qualquer ordem entre si.
 */
export const ORDEM_DE_EXCLUSAO = [
  // Netos e filhos de outras tabelas do mesmo workspace.
  "passoAutomacao",
  "campanhaDestinatario",
  "execucaoAutomacao",
  "versaoAutomacao",
  "automacaoExecucao",
  "gatilhoEtapa",
  "negocioCard",
  "tarefaCard",
  "funilEtapa",
  /* Os números de um funil. Antes de `funil` e depois de `funilEtapa`: é filho do funil, e a
     ordem aqui é a das dependências — apagar o pai primeiro deixaria a linha órfã. */
  "funilNumero",
  "tarefaEtapa",
  "funil",
  "fluxoAutomacao",
  "pastaAutomacao",
  "eventoDeConversao",
  "origemDoLead",
  "toqueDeAnuncio",
  "conversa",
  "contato",
  // Daqui pra baixo, só o workspace é pai.
  "cliqueRastreado",
  "compromisso",
  "motivoPerda",
  "preferencia",
  "mensagemExtra",
  "documentoBiblioteca",
  "respostaFormulario",
  "formulario",
  "documento",
  "modeloPersonalizado",
  "integracao",
  "acaoEnvio",
  "relatorioGerado",
  "whatsappTemplate",
  "anexoPublico",
  "arquivoArmazenado",
  "instagramEvento",
  "eventoDoLead",
  "campanha",
  "template",
  "expediente",
  "chaveDeIntegracao",
  "leadRecebido",
  "confirmacaoDeReuniao",
  "registroDeAuditoria",
  "assinatura",
  // Por último, as pessoas e a própria empresa. Membro tem filhos fora do workspace (sessão e
  // token de senha), apagados logo antes por `membroId`.
  "membro",
] as const;

export type ResultadoDaExclusao = {
  /** Quantas linhas saíram, por tabela. Só as que tinham alguma coisa. */
  apagadas: Record<string, number>;
  total: number;
};

/**
 * Apaga tudo de um workspace e, no fim, o workspace.
 *
 * NÃO é uma transação só. São 45 tabelas, e uma transação dessas em MySQL segura travas em todas
 * elas até o fim — numa base com outros clientes usando o CRM ao mesmo tempo. Como a ordem é de
 * filho pra pai, uma falha no meio deixa a conta parcialmente apagada e repetir a chamada termina
 * o serviço: é o comportamento certo pra uma operação que já é destrutiva por natureza.
 *
 * Quem chama confere o nome digitado antes (ver a rota): isto aqui não pergunta nada.
 */
export async function apagarWorkspace(
  cliente: PrismaClient,
  workspaceId: string,
): Promise<ResultadoDaExclusao> {
  const apagadas: Record<string, number> = {};
  let total = 0;

  const membros = await cliente.membro.findMany({ where: { workspaceId }, select: { id: true } });
  const idsDeMembros = membros.map((m) => m.id);
  if (idsDeMembros.length) {
    // Sessão aberta e token de redefinição não têm `workspaceId`: eles pendem do membro. Sem
    // apagá-los antes, o `delete` do membro bate na chave estrangeira — e, pior, uma sessão
    // sobrevivente continuaria valendo por um tempo pra uma conta que não existe mais.
    const sessoes = await cliente.sessaoAtiva.deleteMany({ where: { membroId: { in: idsDeMembros } } });
    const tokens = await cliente.tokenRedefinicaoSenha.deleteMany({ where: { membroId: { in: idsDeMembros } } });
    if (sessoes.count) apagadas.sessaoAtiva = sessoes.count;
    if (tokens.count) apagadas.tokenRedefinicaoSenha = tokens.count;
    total += sessoes.count + tokens.count;
  }

  for (const tabela of ORDEM_DE_EXCLUSAO) {
    const modelo = (cliente as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }> }>)[tabela];
    if (!modelo?.deleteMany) continue;
    const { count } = await modelo.deleteMany({ where: { workspaceId } });
    if (count) apagadas[tabela] = count;
    total += count;
  }

  await cliente.workspace.delete({ where: { id: workspaceId } });
  apagadas.workspace = 1;
  total += 1;

  return { apagadas, total };
}
