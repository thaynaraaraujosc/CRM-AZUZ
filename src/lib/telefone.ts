import { normalizarNumeroBrasileiro } from "@/lib/integracoes/meta";

/**
 * Normaliza um telefone pra comparação/dedupe: devolve a forma canônica DDI + DDD + 9 + número.
 * Usado em todo lugar que precisa decidir "esse é o mesmo número que aquele?" (criação automática
 * de Contato pelo webhook do WhatsApp, reuso da conversa certa em `conversas/identidade.ts`,
 * dedupe ao salvar contato à mão).
 *
 * O DDI ENTRA AQUI, e isso é uma correção. Antes esta função só tirava a máscara e chamava
 * `normalizarNumeroBrasileiro`, que insere o 9º dígito mas NÃO acrescenta o `55`. Então
 * `"(62) 99999-9999"` (digitado à mão, do jeito que todo mundo digita no Brasil) virava
 * `"62999999999"` e continuava não batendo com `"5562999999999"`, que é o formato que o WhatsApp
 * manda. Era o mesmo cliente duas vezes: dois Contatos, duas conversas, histórico partido no meio,
 * exatamente o problema que o comentário antigo desta função dizia estar resolvido.
 *
 * O `55` só é acrescentado quando o número tem cara de brasileiro sem DDI, e o teste é estreito de
 * propósito, porque errar pra mais funde dois clientes diferentes:
 *
 * - 11 dígitos: DDD plausível (11 a 99, nenhum DDD tem `0`) e `9` logo depois. Celular brasileiro
 *   sempre começa por 9 depois do DDD. É o que separa `62 9 9999-9999` de um `+1 415 555 0123`,
 *   que também tem 11 dígitos e também começa por dois dígitos de 1 a 9.
 * - 10 dígitos: DDD + 8, o fixo (e o celular antigo). Não existe celular brasileiro de 11 dígitos
 *   sem DDD, então aqui não há como confundir com os 11 acima.
 *
 * Qualquer outro tamanho passa intacto: número estrangeiro continua sendo ele mesmo, e como os
 * dois lados da comparação recebem o mesmo tratamento, ele ainda casa consigo.
 */
export function normalizarTelefoneParaComparacao(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return "";

  // `normalizarNumeroBrasileiro` completa o 9º dígito depois, quando couber.
  const semDdi = /^[1-9][1-9]9\d{8}$/.test(digitos) || /^[1-9][1-9]\d{8}$/.test(digitos);
  return normalizarNumeroBrasileiro(semDdi ? `55${digitos}` : digitos);
}

/**
 * O telefone como se escreve pra uma pessoa ler: `+55 (62) 99999-9999`.
 *
 * Existe por causa da menção de quem o CRM não conhece. Mencionar alguém num grupo grava o número
 * cru no texto (`@5562999999999`), e quando não há nome em lugar nenhum pra pôr no lugar o que
 * sobra é esse monte de dígito colado — que ninguém lê como telefone, e que o detector de números
 * ainda tentava transformar em atalho de ligação.
 *
 * Formata só o que tem forma brasileira reconhecível. Número de outro país sai como `+<dígitos>`:
 * inventar parênteses e hífen em cima de um formato que não se conhece deixa o número mais difícil
 * de ler, não menos. Entrada sem dígito nenhum volta como veio, porque devolver string vazia
 * esconderia o problema em vez de mostrá-lo.
 */
export function formatarTelefoneParaExibicao(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return numero;

  // Sem DDI, mas com cara de brasileiro: o mesmo teste estreito de `normalizarTelefoneParaComparacao`.
  const brasileiroSemDdi = /^[1-9][1-9]\d{8,9}$/.test(digitos);
  const comDdi = brasileiroSemDdi ? `55${digitos}` : digitos;

  // 55 + DDD + 8 ou 9 dígitos. Só aqui a máscara brasileira é verdade.
  const casou = /^55([1-9][1-9])(\d{4,5})(\d{4})$/.exec(comDdi);
  if (!casou) return `+${digitos}`;

  const [, ddd, inicio, fim] = casou;
  return `+55 (${ddd}) ${inicio}-${fim}`;
}
