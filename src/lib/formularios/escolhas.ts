/**
 * QUAIS OPÇÕES ESTÃO MARCADAS, lendo a resposta guardada.
 *
 * POR QUE NÃO `valor.split(",")`: a OPÇÃO pode ter vírgula dentro dela. "Posicionamento digital:
 * redes sociais, site e tráfego pago" virava duas metades, nenhuma igual a opção nenhuma — a
 * caixa era marcada, voltava desmarcada no mesmo instante e não havia como escolher aquela
 * resposta. Só as opções sem vírgula funcionavam.
 *
 * Então o texto é percorrido casando OPÇÕES INTEIRAS, as maiores primeiro — sem isso "Sim" tomaria
 * o lugar de "Sim, com ressalvas" e o resto da frase viraria lixo. O formato guardado continua o
 * mesmo ("a, b"), que é o que a lista de respostas e a planilha mostram.
 *
 * Puro, sem React: é regra de texto, e regra de texto se prova sem navegador.
 */
export function escolhasMarcadas(valor: string, opcoes: string[]): string[] {
  let resto = (valor ?? "").trim();
  if (!resto) return [];
  // COMPARA SEM OS ESPAÇOS DAS PONTAS. Opção digitada com um espaço sobrando no construtor —
  // acontece o tempo todo em lista colada de outro lugar — não casava com o texto guardado, e a
  // caixa daquela opção, só dela, ficava impossível de marcar.
  const limpas = opcoes.map((op) => ({ original: op, texto: op.trim() })).filter((o) => o.texto);
  const maioresPrimeiro = [...limpas].sort((a, b) => b.texto.length - a.texto.length);
  const marcadas: string[] = [];

  let achouAlguma = true;
  while (resto && achouAlguma) {
    achouAlguma = false;
    for (const op of maioresPrimeiro) {
      if (resto !== op.texto && !resto.startsWith(`${op.texto},`)) continue;
      marcadas.push(op.original);
      resto = resto.slice(op.texto.length).replace(/^,\s*/, "");
      achouAlguma = true;
      break;
    }
  }
  return marcadas;
}
