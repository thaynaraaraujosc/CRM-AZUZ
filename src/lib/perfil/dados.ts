/**
 * As conferências do perfil da pessoa, num lugar só.
 *
 * Fora do componente e fora da rota porque as DUAS precisam delas: a tela avisa enquanto se
 * digita, o servidor recusa de novo na hora de gravar. Duas cópias da mesma regra é como se
 * chega num campo que a tela aceita e o banco rejeita.
 */

export type Conferencia = { ok: true; valor: string } | { ok: false; erro: string };

function somenteDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

export function lerNomeDoPerfil(valor: string): Conferencia {
  const limpo = valor.trim().replace(/\s+/g, " ");
  if (!limpo) return { ok: false, erro: "O nome não pode ficar em branco." };
  if (limpo.length > 80) return { ok: false, erro: "O nome passou de 80 caracteres." };
  return { ok: true, valor: limpo };
}

/**
 * O telefone da pessoa. Opcional — em branco é uma resposta válida.
 *
 * Mesma régua do telefone da empresa: 10 dígitos com fixo, 11 com celular. Menos que isso é
 * número incompleto, não um formato diferente.
 */
export function lerTelefoneDoPerfil(valor: string): Conferencia {
  const limpo = valor.trim();
  if (!limpo) return { ok: true, valor: "" };
  const digitos = somenteDigitos(limpo);
  if (digitos.length !== 10 && digitos.length !== 11) {
    return { ok: false, erro: "O telefone precisa ter DDD e número: (00) 00000-0000." };
  }
  return { ok: true, valor: formatarTelefoneDoPerfil(digitos) };
}

/** A máscara enquanto se digita. */
export function formatarTelefoneDoPerfil(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * As iniciais do avatar: a primeira letra do primeiro nome e a do último.
 *
 * Um nome só devolve uma letra, e não a primeira e a segunda — "Ana" vira "A", não "AN", que é
 * como as pessoas escrevem iniciais.
 */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}
