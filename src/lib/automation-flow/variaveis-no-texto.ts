/**
 * ACHA AS VARIÁVEIS NO MEIO DO TEXTO DE UMA MENSAGEM.
 *
 * A prévia do bloco mostra a variável como ETIQUETA ("Primeiro nome") em vez de `{primeiro_nome}`:
 * é o que deixa visível ONDE o dado do contato entra, sem inventar um nome de mentira no lugar
 * dele. Pra isso ela precisa partir o texto nos pedaços que são variável e nos que são letra.
 *
 * O motor aceita chave simples e dupla (ver `aplicarVariaveis` em `motor-estado.ts`), então aqui
 * as duas valem. Reconhecer só uma faria metade das mensagens aparecerem com chave crua na tela
 * que existe justamente pra mostrar o que o contato recebe.
 *
 * Mora em `lib` e não no componente porque é regra, e regra é o que tem teste.
 */
export type PedacoDeTexto = { tipo: "texto"; valor: string } | { tipo: "variavel"; valor: string };

export function pedacosDoTexto(texto: string): PedacoDeTexto[] {
  const pedacos: PedacoDeTexto[] = [];
  const padrao = /\{\{?\s*([\w.]+)\s*\}?\}/g;
  let ultimo = 0;
  let achado: RegExpExecArray | null;
  while ((achado = padrao.exec(texto)) !== null) {
    if (achado.index > ultimo) pedacos.push({ tipo: "texto", valor: texto.slice(ultimo, achado.index) });
    pedacos.push({ tipo: "variavel", valor: achado[1] });
    ultimo = achado.index + achado[0].length;
  }
  if (ultimo < texto.length) pedacos.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return pedacos;
}
