import { createHash } from "node:crypto";

/**
 * Os identificadores embaralhados que permitem o Google reencontrar a pessoa sem o código do clique.
 *
 * POR QUE ISTO EXISTE. O código do clique (`gclid`) é a forma mais precisa de ligar uma venda ao
 * anúncio, e é também a mais frágil: ele vive na URL e no navegador. iPhone com rastreamento
 * limitado, bloqueador, pessoa que limpa cookie, link compartilhado no WhatsApp — em todos esses
 * casos ele não chega, e a venda fica sem como ser devolvida. A cada ano que passa isso acontece
 * com mais gente, não com menos.
 *
 * As Conversões Aprimoradas resolvem por outro caminho: em vez do código do clique, o CRM manda o
 * e-mail e o telefone da pessoa. Não o dado em si — o RESUMO CRIPTOGRÁFICO dele. O Google faz o
 * mesmo resumo nos dados que ele já tem e compara os dois; se baterem, ele sabe que é a mesma
 * pessoa. Ninguém dos dois lados consegue ler o dado do outro, porque o resumo não tem volta.
 *
 * NORMALIZAR ANTES DE EMBARALHAR NÃO É DETALHE. "Ana@Gmail.com " e "ana@gmail.com" produzem
 * resumos completamente diferentes, então uma maiúscula ou um espaço sobrando basta pra a pessoa
 * nunca ser reencontrada. E a falha é silenciosa: o Google aceita, não casa nada, e ninguém
 * descobre. Por isso cada regra aqui embaixo é uma exigência da documentação, não gosto.
 */

/** Resumo SHA-256 em hexadecimal minúsculo, que é o formato que o Google exige. */
function resumo(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/**
 * E-mail no formato que o Google espera: sem espaço nas pontas e tudo em minúscula.
 *
 * O ponto no nome do Gmail NÃO é removido de propósito. É verdade que o Gmail ignora pontos, mas
 * o Google pede o endereço como a pessoa digitou, e é assim que ele guarda do lado dele: "limpar"
 * o ponto aqui produziria um resumo que não casa com nada.
 */
export function emailParaEnvio(bruto: string | null | undefined): string | null {
  const limpo = (bruto ?? "").trim().toLowerCase();
  if (!limpo || !limpo.includes("@") || limpo.length < 5) return null;
  return resumo(limpo);
}

/**
 * Telefone no formato internacional E.164: só dígitos, com o código do país, precedido de "+".
 *
 * O CRM guarda número brasileiro de vários jeitos — com máscara, sem DDI, com o 9 na frente ou
 * não. Sem esta normalização, o mesmo cliente vira três resumos diferentes e nenhum casa.
 */
export function telefoneParaEnvio(bruto: string | null | undefined): string | null {
  let digitos = (bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  // Número guardado sem o código do país. 10 dígitos = fixo com DDD, 11 = celular com DDD: nos
  // dois casos falta o 55 do Brasil. Acima disso o DDI já veio junto.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;

  // Menos de 12 não é um número completo com DDI; mais de 15 não existe em E.164. Nos dois casos
  // é melhor não mandar do que mandar lixo que nunca vai casar.
  if (digitos.length < 12 || digitos.length > 15) return null;
  return resumo(`+${digitos}`);
}

export type IdentificadorDeUsuario = { hashedEmail: string } | { hashedPhoneNumber: string };

/**
 * Monta a lista de identificadores de uma pessoa, no formato da API do Google.
 *
 * Os dois entram quando existem: mais de um identificador aumenta a chance de casar, e o Google
 * aceita até cinco por conversão.
 */
export function identificadoresDoContato(contato: {
  email?: string | null;
  whatsapp?: string | null;
}): IdentificadorDeUsuario[] {
  const lista: IdentificadorDeUsuario[] = [];
  const email = emailParaEnvio(contato.email);
  if (email) lista.push({ hashedEmail: email });
  const telefone = telefoneParaEnvio(contato.whatsapp);
  if (telefone) lista.push({ hashedPhoneNumber: telefone });
  return lista;
}
