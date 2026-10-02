import type { PerguntaFormulario } from "@/lib/formularios-context";
import type { EnderecoDoCep } from "@/lib/formularios/documentos";

/**
 * Quais campos do formulário o CEP preenche sozinho.
 *
 * COMO ELE DECIDE: pelo nome do campo, não por configuração. Quem monta um formulário já escreve
 * "Rua", "Bairro", "Cidade" e "Estado" nos rótulos, e pedir pra apontar cada um num seletor à
 * parte seria trabalho de configuração pra confirmar o óbvio. Se nada casar, nada é preenchido, e
 * o CEP continua sendo só mais um campo.
 *
 * O rótulo é comparado sem acento e sem maiúscula, então "Endereço", "endereco" e "ENDEREÇO" são
 * a mesma coisa.
 *
 * Só preenche campo de texto. Lista suspensa entra só quando o valor existe entre as opções: um
 * seletor de estado com as 27 siglas aceita "GO", um com nomes por extenso não, e é melhor não
 * mexer do que deixar o campo mostrando vazio como se a pessoa não tivesse respondido.
 */

const REGRAS: { chave: keyof EnderecoDoCep; termos: string[] }[] = [
  { chave: "rua", termos: ["rua", "endereco", "logradouro", "av", "avenida"] },
  { chave: "bairro", termos: ["bairro"] },
  { chave: "cidade", termos: ["cidade", "municipio", "localidade"] },
  { chave: "estado", termos: ["estado", "uf"] },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Uma palavra inteira, pra "uf" não casar com "sufixo" nem "rua" com "gruas". */
function contemPalavra(texto: string, termo: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${termo}([^a-z0-9]|$)`).test(texto);
}

export function valoresDoEndereco(
  perguntas: PerguntaFormulario[],
  endereco: EnderecoDoCep,
): Record<string, string> {
  const preenchidos: Record<string, string> = {};
  const jaUsados = new Set<keyof EnderecoDoCep>();

  for (const pergunta of perguntas) {
    if (pergunta.tipo !== "texto_curto" && pergunta.tipo !== "texto_longo" && pergunta.tipo !== "lista_suspensa") continue;
    const rotulo = normalizar(pergunta.rotulo || "");
    if (!rotulo) continue;

    // O primeiro campo que casa fica com o valor: num formulário com "Cidade" e "Cidade onde
    // atende", o de cima é o do endereço.
    const regra = REGRAS.find((r) => !jaUsados.has(r.chave) && r.termos.some((t) => contemPalavra(rotulo, t)));
    if (!regra) continue;

    const valor = endereco[regra.chave];
    if (!valor) continue;
    if (pergunta.tipo === "lista_suspensa" && !(pergunta.opcoes ?? []).some((o) => normalizar(o) === normalizar(valor))) continue;

    preenchidos[pergunta.id] = valor;
    jaUsados.add(regra.chave);
  }

  return preenchidos;
}
