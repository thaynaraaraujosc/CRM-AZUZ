/**
 * Documentos brasileiros: CPF, CNPJ, CEP e telefone.
 *
 * POR QUE ISTO EXISTE (24/09/2026): até aqui os campos de CPF e CNPJ eram caixas de texto com o
 * formato só sugerido no placeholder. Aceitavam 111.111.111-11 e qualquer sequência de dígitos.
 * Num formulário ligado a anúncio pago isso é lead sujo entrando direto na lista do cliente, e é
 * justamente o que a concorrência confere.
 *
 * Sem dependência nova: são quatro contas de resto de divisão e uma contagem de dígitos.
 *
 * Nenhuma função daqui importa React nem o contexto do construtor, de propósito: assim a mesma
 * conferência pode rodar no servidor depois, na rota que recebe a resposta.
 */

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Confere o dígito verificador do CPF.
 *
 * As sequências repetidas (000.000.000-00, 111.111.111-11 e as outras nove) passam na conta do
 * dígito por acidente da matemática, então são barradas à parte. É o número que alguém digita
 * quando não quer dar o CPF de verdade.
 */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  for (const [ate, posicao] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (posicao - i);
    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;
    if (digito !== Number(d[ate])) return false;
  }
  return true;
}

/** Confere os dois dígitos verificadores do CNPJ. Mesma ideia do CPF, com outros pesos. */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const conferir = (ate: number) => {
    let peso = ate - 7;
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return (resto < 2 ? 0 : 11 - resto) === Number(d[ate]);
  };
  return conferir(12) && conferir(13);
}

/** CEP é só formato: oito dígitos. Se existe de verdade, quem responde pela busca é os Correios. */
export function cepValido(valor: string): boolean {
  return somenteDigitos(valor).length === 8;
}

/**
 * Telefone brasileiro: DDD de 11 a 99 mais oito dígitos (fixo) ou nove começando em 9 (celular).
 *
 * Não confere se a linha existe, só se o número tem cara de número. É o suficiente pra barrar o
 * "99999-9999" digitado às pressas e o telefone com um dígito a menos, que é o erro que mais
 * acontece e o que mais custa: o cliente liga e cai em lugar nenhum.
 */
export function telefoneValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  const semPais = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (semPais.length !== 10 && semPais.length !== 11) return false;
  if (Number(semPais.slice(0, 2)) < 11) return false;
  if (semPais.length === 11 && semPais[2] !== "9") return false;
  return true;
}

/** E-mail: um @, algo antes, e um domínio com ponto depois. */
export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(valor.trim());
}

/**
 * A máscara padrão de cada tipo, aplicada enquanto a pessoa digita.
 *
 * Antes só existia máscara quando quem montou o formulário escrevia o padrão na mão, campo por
 * campo. Ninguém fazia isso, então o CPF chegava de dez jeitos diferentes na planilha.
 *
 * Telefone fica de fora: o padrão muda entre celular (9 dígitos) e fixo (8), e uma máscara fixa
 * travaria um dos dois. Ele tem tratamento próprio em `mascaraDeTelefone`.
 */
export const MASCARA_PADRAO: Record<string, string> = {
  cpf: "999.999.999-99",
  cnpj: "99.999.999/9999-99",
  cep: "99999-999",
};

/** Telefone: escolhe o padrão pelo tanto de dígito já digitado, pra caber celular e fixo. */
export function mascaraDeTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export type EnderecoDoCep = {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
};

/**
 * Busca o endereço do CEP nos Correios, pela ViaCEP (pública, sem cadastro nem chave).
 *
 * Devolve `null` em qualquer problema, inclusive CEP que não existe e internet fora: quem está
 * respondendo o formulário continua podendo digitar o endereço na mão. Uma busca de conveniência
 * nunca pode impedir o envio de um lead.
 */
export async function buscarEnderecoDoCep(cep: string, sinal?: AbortSignal): Promise<EnderecoDoCep | null> {
  const d = somenteDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: sinal });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (corpo.erro) return null;
    return {
      rua: corpo.logradouro ?? "",
      bairro: corpo.bairro ?? "",
      cidade: corpo.localidade ?? "",
      estado: corpo.uf ?? "",
    };
  } catch {
    return null;
  }
}
