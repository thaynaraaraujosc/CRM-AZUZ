/**
 * As variáveis que dá pra usar numa mensagem de automação.
 *
 * A lista antiga tinha 14 itens e a maioria não saía de lugar nenhum: "clínica", "data da
 * consulta", "profissional", "unidade" e "link de agendamento" não existem no contato nem em
 * nenhum outro registro que o motor enxergue na hora de enviar. Escolher uma delas no menu
 * produzia um buraco na mensagem que chegava ao cliente, sem aviso nenhum.
 *
 * Ficaram só as que o motor sabe resolver de verdade (ver `valorDoContato` em
 * `src/lib/automacoes/motor-estado.ts`). Campo personalizado do contato também funciona: é só
 * escrever o nome dele entre chaves, mesmo não estando nesta lista.
 *
 * O formato é de chave SIMPLES. O motor aceita simples e dupla, mas o menu escreve uma só, pra
 * ninguém precisar decidir qual usar.
 */
export const VARIAVEIS_MENSAGEM: { token: string; label: string }[] = [
  { token: "{primeiro_nome}", label: "Primeiro nome" },
  { token: "{nome_completo}", label: "Nome completo" },
  { token: "{telefone}", label: "Telefone" },
  { token: "{email}", label: "E-mail" },
  { token: "{empresa}", label: "Empresa" },
  { token: "{cargo}", label: "Cargo" },
  { token: "{cidade}", label: "Cidade" },
  { token: "{estado}", label: "Estado" },
  { token: "{atendente}", label: "Atendente responsável" },
  { token: "{etapa_funil}", label: "Etapa do funil" },
  { token: "{valor_negocio}", label: "Valor do negócio" },
  { token: "{origem}", label: "Origem do lead" },
  { token: "{data}", label: "Data de hoje" },
  { token: "{horario}", label: "Horário do envio" },
];

/** Insere o token na posição do cursor (ou no fim, se não houver seleção) e devolve o texto novo. */
export function inserirTokenNoTexto(
  valorAtual: string,
  token: string,
  elemento: HTMLTextAreaElement | HTMLInputElement | null,
): string {
  if (!elemento) return `${valorAtual}${token}`;
  const inicio = elemento.selectionStart ?? valorAtual.length;
  const fim = elemento.selectionEnd ?? valorAtual.length;
  return `${valorAtual.slice(0, inicio)}${token}${valorAtual.slice(fim)}`;
}
