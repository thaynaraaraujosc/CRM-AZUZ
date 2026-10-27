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
 * O telefone como se escreve pra uma pessoa ler: `+55 (62) 99999-9999`. `null` quando o que chegou
 * não tem forma de telefone brasileiro.
 *
 * O `null` é o ponto deste arquivo, e ele veio de um erro meu de 15/10/2026. A versão anterior
 * devolvia `+<dígitos>` pra qualquer coisa que não reconhecesse, e com isso passou a escrever
 * `+33230329753761` embaixo de uma menção — um `+` e quatorze dígitos, com toda a cara de telefone
 * internacional. Não é telefone nenhum.
 *
 * O WhatsApp migrou os participantes de grupo pra um identificador novo, o LID (`@lid`), que tem
 * 14 ou 15 dígitos e NÃO é o número da pessoa. Ele cabe no tamanho de um número E.164, começa por
 * dígitos que parecem código de país, e não há como distinguir um do outro só olhando. Então a
 * regra passa a ser: formata o que tem forma brasileira reconhecível, e para o resto devolve
 * `null` pra quem chamou decidir — em vez de carimbar um `+` na frente e transformar um
 * identificador interno em telefone falso na tela de alguém.
 *
 * Entrada sem dígito nenhum também é `null`: devolver string vazia esconderia o problema.
 */
export function formatarTelefoneParaExibicao(numero: string): string | null {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return null;

  // Sem DDI, mas com cara de brasileiro: o mesmo teste estreito de `normalizarTelefoneParaComparacao`.
  const brasileiroSemDdi = /^[1-9][1-9]\d{8,9}$/.test(digitos);
  const comDdi = brasileiroSemDdi ? `55${digitos}` : digitos;

  // 55 + DDD + 8 ou 9 dígitos. Só aqui a máscara brasileira é verdade.
  const casou = /^55([1-9][1-9])(\d{4,5})(\d{4})$/.exec(comDdi);
  if (casou) {
    const [, ddd, inicio, fim] = casou;
    return `+55 (${ddd}) ${inicio}-${fim}`;
  }

  return formatarInternacional(digitos);
}

/**
 * NÚMERO DE FORA DO BRASIL.
 *
 * Antes isto devolvia `null`, e a tela caía nos dígitos crus: um cliente de Portugal aparecia como
 * "351910436018", sem um espaço sequer. O CRM é vendido pra quem atende de qualquer lugar, e uma
 * sequência de doze dígitos não se lê nem se confere.
 *
 * NÃO INVENTA A MÁSCARA DO PAÍS. Cada país agrupa do seu jeito, e fingir que 351910436018 é
 * "(91) 0436-018" seria escrever um telefone que não existe. O que dá pra afirmar é o DDI — os
 * prefixos de 1 a 3 dígitos estão na lista oficial — e depois disso o resto sai em grupos de três,
 * que é como se lê número em voz alta em qualquer lugar.
 *
 * O LIMITE É 13 DÍGITOS, e não os 15 que o padrão E.164 permite. O corte mais curto é deliberado
 * e vem de uma decisão que já existia no CRM: o LID do WhatsApp tem catorze ou quinze dígitos e
 * começa por algo que parece código de país (`33230329753761` passaria por francês), e o IGSID do
 * Instagram é mais longo ainda. Nenhum dos dois é telefone, e não dá pra distinguir olhando.
 *
 * O preço é um número internacional raro, de catorze dígitos, aparecer sem máscara. O preço do
 * outro lado seria a tela oferecer uma ligação pra um número que não existe — e esse é pior. Ver
 * `conversas/participantes.ts`, onde essa escolha foi feita primeiro.
 */
function formatarInternacional(digitos: string): string | null {
  if (digitos.length < 8 || digitos.length > 13) return null;

  const ddi = DDI_DE_TRES.has(digitos.slice(0, 3))
    ? digitos.slice(0, 3)
    : DDI_DE_DOIS.has(digitos.slice(0, 2))
      ? digitos.slice(0, 2)
      : DDI_DE_UM.has(digitos.slice(0, 1))
        ? digitos.slice(0, 1)
        : null;
  if (!ddi) return null;

  const resto = digitos.slice(ddi.length);
  if (!resto) return null;
  return `+${ddi} ${emGrupos(resto)}`;
}

/**
 * O resto do número em grupos de três, com uma exceção: sobrando UM dígito no fim, ele se junta ao
 * grupo anterior em vez de ficar sozinho.
 *
 * Sem a exceção, um número de dez dígitos — o tamanho dos Estados Unidos — saía como
 * "415 555 267 1", com um algarismo órfão no fim que lê como erro de digitação. Com ela sai
 * "415 555 2671", que por acaso é a divisão que os americanos usam. Portugal, com nove, continua
 * em "910 436 018".
 */
function emGrupos(resto: string): string {
  const grupos = resto.match(/\d{1,3}/g) ?? [resto];
  if (grupos.length > 1 && grupos[grupos.length - 1].length === 1) {
    grupos[grupos.length - 2] += grupos.pop();
  }
  return grupos.join(" ");
}

/**
 * Os DDIs, por tamanho. Não é a lista inteira do mundo: é a que permite CORTAR o prefixo com
 * certeza. País que não está aqui cai em `null`, e a tela mostra os dígitos como vieram — que é
 * melhor que recortar no lugar errado e exibir um país que não é o da pessoa.
 *
 * Os de um dígito são só dois (1 = Estados Unidos e Canadá, 7 = Rússia e Cazaquistão), e por isso
 * a ordem da conferência é do mais longo pro mais curto: `1` é prefixo de `1` e de nada mais, mas
 * `3` é começo de `351`, e testar o curto primeiro cortaria Portugal no lugar errado.
 */
const DDI_DE_UM = new Set(["1", "7"]);
const DDI_DE_DOIS = new Set([
  "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47",
  "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65",
  "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98",
]);
const DDI_DE_TRES = new Set([
  "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
  "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243",
  "244", "245", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260",
  "261", "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299",
  "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373",
  "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "420",
  "421", "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591",
  "592", "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675", "676",
  "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691",
  "692", "850", "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965",
  "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992", "993", "994",
  "995", "996", "998",
]);
