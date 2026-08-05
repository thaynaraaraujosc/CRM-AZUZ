import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Criptografa/descriptografa tokens de integração (AES-256-GCM) — diferente do bcrypt usado no
 * login: senha só precisa ser *verificada* (hash de mão única basta), mas o token de acesso
 * precisa ser *usado de novo* depois (pra mandar mensagem/buscar relatório), então tem que dar pra
 * recuperar o valor original.
 *
 * `INTEGRACAO_ENCRYPTION_KEY` (.env) é uma chave de 32 bytes gerada uma vez (`openssl rand -base64
 * 32`) — deriva a chave AES real via scrypt em vez de usar os bytes crus direto, pra não depender
 * do formato exato (base64/hex/utf8) que a env var tiver.
 */
function chaveDerivada(): Buffer {
  const segredo = process.env.INTEGRACAO_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error("INTEGRACAO_ENCRYPTION_KEY não configurada — necessária pra guardar tokens de integração.");
  }
  return scryptSync(segredo, "azuz-crm-integracoes", 32);
}

/** Formato guardado no banco: `iv:tagDeAutenticacao:conteudoCriptografado`, tudo em base64. */
export function encriptar(textoPlano: string): string {
  const chave = chaveDerivada();
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave, iv);
  const criptografado = Buffer.concat([cifra.update(textoPlano, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv, tag, criptografado].map((parte) => parte.toString("base64")).join(":");
}

export function decriptar(valorCriptografado: string): string {
  const [ivB64, tagB64, dadosB64] = valorCriptografado.split(":");
  if (!ivB64 || !tagB64 || !dadosB64) {
    throw new Error("Valor criptografado em formato inesperado.");
  }
  const chave = chaveDerivada();
  const decifra = createDecipheriv("aes-256-gcm", chave, Buffer.from(ivB64, "base64"));
  decifra.setAuthTag(Buffer.from(tagB64, "base64"));
  const textoPlano = Buffer.concat([decifra.update(Buffer.from(dadosB64, "base64")), decifra.final()]);
  return textoPlano.toString("utf8");
}
