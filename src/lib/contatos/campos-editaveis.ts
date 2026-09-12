/**
 * Os campos de `Contato` que o navegador pode escrever. LISTA FECHADA.
 *
 * Antes o corpo da requisição ia espalhado direto pro Prisma (`data: { ...dados }`). Quer dizer:
 * qualquer campo que o navegador mandasse era gravado, incluindo os que ninguém pretendia expor:
 *
 * - `workspaceId`: mover o contato de uma empresa para outra. Escrita cruzando workspaces, que é
 *   exatamente o que o isolamento existe pra impedir;
 * - `id`: trocar a chave primária e colidir com outro registro;
 * - `criadoEm`: reescrever a data de criação e desalinhar relatório e ordenação.
 *
 * Nada disso era intenção de ninguém; era só o `...` fazendo o que `...` faz. Campo novo no schema
 * não entra sozinho: precisa ser escrito aqui, de propósito.
 */
export const CAMPOS_CONTATO_EDITAVEIS = [
  "initials",
  "nome",
  "origem",
  "etapa",
  "responsavel",
  "ultima",
  "valor",
  "email",
  "whatsapp",
  "nascimento",
  "endereco",
  "sobrenome",
  "empresa",
  "cargo",
  "telefoneFixo",
  "cidade",
  "estado",
  "pais",
  "canalPreferido",
  "melhorHorario",
  "instagram",
  "instagramId",
  "igSeguidores",
  "igVerificado",
  "igSegueVoce",
  "igVoceSegue",
  "igPerfilAtualizado",
  "fotoUrl",
  "etiquetas",
  "favorito",
  "criadoVia",
] as const;

/** Filtra o corpo recebido, deixando passar só o que está na lista. */
export function somenteCamposDeContato(corpo: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const campo of CAMPOS_CONTATO_EDITAVEIS) {
    if (corpo[campo] !== undefined) limpo[campo] = corpo[campo];
  }
  // `etiquetas` é JSON no banco: `null` apaga a lista, `undefined` deixa como está. Mandar `null`
  // por engano (o front manda quando não há etiqueta nenhuma) não pode zerar o campo.
  if (limpo.etiquetas === null) delete limpo.etiquetas;
  return limpo;
}
