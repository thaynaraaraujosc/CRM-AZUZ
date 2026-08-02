/** Variáveis disponíveis pra interpolar em mensagens — spec seção 4. */
export const VARIAVEIS_MENSAGEM: { token: string; label: string }[] = [
  { token: "{primeiro_nome}", label: "Primeiro nome" },
  { token: "{nome_completo}", label: "Nome completo" },
  { token: "{empresa}", label: "Empresa" },
  { token: "{telefone}", label: "Telefone" },
  { token: "{atendente}", label: "Atendente" },
  { token: "{clinica}", label: "Clínica" },
  { token: "{data}", label: "Data" },
  { token: "{horario}", label: "Horário" },
  { token: "{data_consulta}", label: "Data da consulta" },
  { token: "{profissional}", label: "Profissional" },
  { token: "{unidade}", label: "Unidade" },
  { token: "{link_agendamento}", label: "Link de agendamento" },
  { token: "{valor_negocio}", label: "Valor do negócio" },
  { token: "{etapa_funil}", label: "Etapa do funil" },
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
