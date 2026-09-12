/**
 * O formulário usa campo de contato ou de responsável?
 *
 * Existe por causa de um vazamento real: `GET /api/formularios/[id]/contatos-sugeridos` é PÚBLICA
 * (um lead que responde um formulário não tem login) e devolvia o nome de TODOS os contatos do
 * workspace, para qualquer pessoa com o id do formulário em mãos. E o id do formulário está no
 * link que o cliente divulga. Na prática: a carteira de clientes inteira de uma empresa, aberta,
 * mesmo em formulário que não tem campo de contato nenhum.
 *
 * A lista só faz sentido quando existe um campo que a consome. Esta função é o que decide isso, e
 * roda antes de ler contato nenhum do banco.
 *
 * Lê o JSON de `paginas` de forma defensiva: o formato já mudou de versão e um formulário antigo
 * não pode derrubar a rota. Na dúvida responde `false`, que é o lado seguro (a lista não aparece;
 * ninguém vaza).
 */
export function formularioUsaCampo(paginas: unknown, tipoProcurado: "contato" | "responsavel"): boolean {
  if (!Array.isArray(paginas)) return false;
  for (const pagina of paginas) {
    const perguntas = (pagina as { perguntas?: unknown })?.perguntas;
    if (!Array.isArray(perguntas)) continue;
    for (const pergunta of perguntas) {
      if ((pergunta as { tipo?: unknown })?.tipo === tipoProcurado) return true;
    }
  }
  return false;
}
