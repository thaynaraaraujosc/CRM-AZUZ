import { cnpjValido, cpfValido, emailValido, somenteDigitos } from "@/lib/formularios/documentos";

/**
 * Os dados da empresa, conferidos pelas MESMAS regras na tela e no servidor.
 *
 * Puro de propósito — sem React, sem banco, sem rede. A tela precisa avisar enquanto a pessoa
 * digita, e a rota precisa recusar mesmo quando o pedido não veio da tela. Duas cópias da regra é
 * como se chega no estado em que o formulário aceita e a API rejeita (ou pior: o contrário).
 *
 * TUDO É OPCIONAL, menos o nome do espaço de trabalho. Uma agência pode não ter CNPJ ainda, ou não
 * querer o endereço no produto. Exigir preenchimento aqui seria inventar uma obrigação que o CRM
 * não tem — e travar a tela de quem só queria trocar a logo.
 */

export type Conferencia = { ok: true; valor: string } | { ok: false; erro: string };

function vazio(valor: string): boolean {
  return !valor.trim();
}

/** O nome do espaço de trabalho: o único campo que não pode ficar em branco. */
export function lerNomeDoEspaco(valor: string): Conferencia {
  const limpo = valor.trim();
  if (!limpo) return { ok: false, erro: "O nome do espaço de trabalho não pode ficar em branco." };
  if (limpo.length > 120) return { ok: false, erro: "O nome do espaço de trabalho passou de 120 caracteres." };
  return { ok: true, valor: limpo };
}

/** Razão social e nome fantasia: texto livre com teto. */
export function lerNomeDeEmpresa(valor: string, comoChamar: string): Conferencia {
  const limpo = valor.trim();
  if (!limpo) return { ok: true, valor: "" };
  if (limpo.length > 120) return { ok: false, erro: `${comoChamar} passou de 120 caracteres.` };
  return { ok: true, valor: limpo };
}

/**
 * CPF ou CNPJ, pelo dígito verificador.
 *
 * Conferir de verdade, e não só contar dígitos: um campo que aceita 111.111.111-11 é um campo que
 * não serve pra nota fiscal nem pra cobrança — e este é o mesmo documento da assinatura.
 */
export function lerDocumentoDaEmpresa(valor: string): Conferencia {
  if (vazio(valor)) return { ok: true, valor: "" };
  const digitos = somenteDigitos(valor);
  if (digitos.length === 11) {
    return cpfValido(digitos) ? { ok: true, valor: formatarDocumento(digitos) } : { ok: false, erro: "Este CPF não existe. Confira os números." };
  }
  if (digitos.length === 14) {
    return cnpjValido(digitos) ? { ok: true, valor: formatarDocumento(digitos) } : { ok: false, erro: "Este CNPJ não existe. Confira os números." };
  }
  return { ok: false, erro: "O CNPJ tem 14 dígitos e o CPF tem 11. Confira o que foi digitado." };
}

/** A máscara enquanto se digita: vira CPF ou CNPJ conforme a quantidade de dígitos. */
export function formatarDocumento(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function lerEmailDaEmpresa(valor: string): Conferencia {
  if (vazio(valor)) return { ok: true, valor: "" };
  const limpo = valor.trim();
  if (limpo.length > 120) return { ok: false, erro: "O e-mail da empresa passou de 120 caracteres." };
  return emailValido(limpo) ? { ok: true, valor: limpo } : { ok: false, erro: "Este e-mail não parece certo. Confira o que foi digitado." };
}

export function lerTelefoneDaEmpresa(valor: string): Conferencia {
  if (vazio(valor)) return { ok: true, valor: "" };
  const digitos = somenteDigitos(valor);
  // 10 com fixo, 11 com celular. Menos do que isso é número incompleto, não um formato diferente.
  if (digitos.length !== 10 && digitos.length !== 11) {
    return { ok: false, erro: "O telefone precisa ter DDD e número: (00) 00000-0000." };
  }
  return { ok: true, valor: formatarTelefoneDaEmpresa(digitos) };
}

/** A máscara do telefone enquanto se digita. */
export function formatarTelefoneDaEmpresa(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * O site. Aceita como as pessoas escrevem — "suaempresa.com.br", sem http.
 *
 * Exigir o `https://` seria pedir que alguém digite o que o navegador esconde há dez anos. O que
 * não passa é o que não tem forma de endereço nenhuma.
 */
export function lerSiteDaEmpresa(valor: string): Conferencia {
  if (vazio(valor)) return { ok: true, valor: "" };
  const limpo = valor.trim();
  if (limpo.length > 200) return { ok: false, erro: "O site passou de 200 caracteres." };
  const semProtocolo = limpo.replace(/^https?:\/\//i, "");
  if (!/^[^\s./]+(\.[^\s./]+)+(\/\S*)?$/.test(semProtocolo)) {
    return { ok: false, erro: "Este site não parece certo. Escreva como suaempresa.com.br." };
  }
  return { ok: true, valor: limpo };
}

export function lerEnderecoDaEmpresa(valor: string): Conferencia {
  if (vazio(valor)) return { ok: true, valor: "" };
  const limpo = valor.trim();
  if (limpo.length > 300) return { ok: false, erro: "O endereço passou de 300 caracteres." };
  return { ok: true, valor: limpo };
}

export type DadosDaEmpresa = {
  empresaNome: string;
  empresaFantasia: string;
  empresaDocumento: string;
  empresaEmail: string;
  empresaTelefone: string;
  empresaSite: string;
  empresaEndereco: string;
};

/**
 * Confere o conjunto inteiro e devolve os valores já normalizados.
 *
 * Para no PRIMEIRO erro, e isso é escolha: uma lista de seis erros de uma vez obriga a pessoa a
 * procurar qual campo é qual. Um erro por vez, dizendo o campo, é o que dá pra agir.
 */
export function lerDadosDaEmpresa(bruto: Partial<DadosDaEmpresa>): { ok: true; dados: DadosDaEmpresa } | { ok: false; erro: string } {
  const conferencias: [keyof DadosDaEmpresa, Conferencia][] = [
    ["empresaNome", lerNomeDeEmpresa(bruto.empresaNome ?? "", "O nome da empresa")],
    ["empresaFantasia", lerNomeDeEmpresa(bruto.empresaFantasia ?? "", "O nome fantasia")],
    ["empresaDocumento", lerDocumentoDaEmpresa(bruto.empresaDocumento ?? "")],
    ["empresaEmail", lerEmailDaEmpresa(bruto.empresaEmail ?? "")],
    ["empresaTelefone", lerTelefoneDaEmpresa(bruto.empresaTelefone ?? "")],
    ["empresaSite", lerSiteDaEmpresa(bruto.empresaSite ?? "")],
    ["empresaEndereco", lerEnderecoDaEmpresa(bruto.empresaEndereco ?? "")],
  ];

  const dados = {} as DadosDaEmpresa;
  for (const [campo, conferencia] of conferencias) {
    if (!conferencia.ok) return { ok: false, erro: conferencia.erro };
    dados[campo] = conferencia.valor;
  }
  return { ok: true, dados };
}
