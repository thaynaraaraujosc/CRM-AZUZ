import { lookup } from "node:dns/promises";

/**
 * O endereço que uma automação quer chamar aponta pra fora mesmo?
 *
 * A ação "chamar webhook" deixa a pessoa digitar qualquer endereço, e o servidor do CRM faz a
 * chamada. Isso é SSRF: o pedido sai de DENTRO da infraestrutura, com o acesso de rede que ela
 * tem e o visitante não. Apontando pra `http://169.254.169.254/` (o serviço de metadados da
 * hospedagem) a resposta pode conter credencial da própria máquina; apontando pra `127.0.0.1` ou
 * pra um IP privado, alcança serviço interno que nunca esteve publicado.
 *
 * Num SaaS isso não é hipótese remota: qualquer cliente que assine o produto tem acesso à tela de
 * automações, então qualquer cliente é um atacante em potencial.
 *
 * A defesa resolve o nome ANTES de chamar e recusa quando ele aponta pra dentro. Resolver é o
 * ponto: barrar só pelo texto do endereço não pega `http://meu-dominio.com` apontando pra
 * 127.0.0.1, que é o jeito clássico de contornar uma lista de nomes proibidos.
 */

/** Faixas que nunca são um destino legítimo de webhook. */
function ehIpInterno(ip: string): boolean {
  // IPv6: laço local, endereços únicos locais (fc00::/7) e link-local (fe80::/10).
  if (ip.includes(":")) {
    const normalizado = ip.toLowerCase();
    if (normalizado === "::1" || normalizado === "::") return true;
    if (/^f[cd]/.test(normalizado)) return true;
    if (/^fe[89ab]/.test(normalizado)) return true;
    // IPv4 embutido em IPv6 (`::ffff:127.0.0.1`).
    const embutido = normalizado.match(/((\d{1,3}\.){3}\d{1,3})$/);
    return embutido ? ehIpInterno(embutido[1]) : false;
  }

  // Só decide sobre o que É um IPv4. Um nome de domínio ("hooks.exemplo.com") não é endereço
  // nenhum: quem resolve nome é `destinoExternoPermitido`, e tratar nome como IP aqui barrava todo
  // webhook legítimo.
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const partes = ip.split(".").map(Number);
  if (partes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = partes;

  if (a === 0) return true; // "este host"
  if (a === 10) return true; // privada
  if (a === 127) return true; // laço local
  if (a === 169 && b === 254) return true; // link-local: é aqui que mora o metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true; // privada
  if (a === 192 && b === 168) return true; // privada
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast e reservado
  return false;
}

export type VerificacaoDeDestino = { permitido: true } | { permitido: false; motivo: string };

/**
 * Confere um endereço de webhook. Parte pura da regra (esquema e formato) separada da resolução de
 * nome, que precisa de rede.
 */
export function formatoDeDestinoAceito(endereco: string): VerificacaoDeDestino {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return { permitido: false, motivo: "Endereço do webhook inválido." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { permitido: false, motivo: "O webhook precisa começar com http:// ou https://." };
  }
  // Um endereço já escrito como IP interno é recusado sem sequer consultar o DNS.
  if (ehIpInterno(url.hostname.replace(/^\[|\]$/g, ""))) {
    return { permitido: false, motivo: "Esse endereço aponta pra dentro da rede do servidor." };
  }
  if (!url.hostname.includes(".") && !url.hostname.includes(":")) {
    // `http://localhost`, `http://banco`: nome sem ponto é nome de rede interna.
    return { permitido: false, motivo: "Esse endereço aponta pra dentro da rede do servidor." };
  }
  return { permitido: true };
}

/** A verificação completa: formato mais o IP pra onde o nome resolve de verdade. */
export async function destinoExternoPermitido(endereco: string): Promise<VerificacaoDeDestino> {
  const formato = formatoDeDestinoAceito(endereco);
  if (!formato.permitido) return formato;

  const hostname = new URL(endereco).hostname.replace(/^\[|\]$/g, "");
  try {
    const resolvidos = await lookup(hostname, { all: true });
    if (!resolvidos.length) return { permitido: false, motivo: "Não foi possível resolver o endereço do webhook." };
    // Basta UM endereço interno pra recusar: um nome que devolve os dois é exatamente a forma de
    // contornar a checagem.
    if (resolvidos.some((r) => ehIpInterno(r.address))) {
      return { permitido: false, motivo: "Esse endereço aponta pra dentro da rede do servidor." };
    }
  } catch {
    return { permitido: false, motivo: "Não foi possível resolver o endereço do webhook." };
  }
  return { permitido: true };
}

export { ehIpInterno };
