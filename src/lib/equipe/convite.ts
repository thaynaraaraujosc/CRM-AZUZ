import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * O token que autoriza aceitar um convite.
 *
 * Por que existe: o link de convite era `/convite/<id do membro>`, e o id é o slug do nome
 * ("João Silva" → "joao-silva"). Adivinhável, sem prazo e sem segredo nenhum. Quem chutasse o nome
 * de alguém com convite pendente definia a senha daquela conta, sem estar logado, e entrava no
 * workspace da empresa. Era o caminho mais curto pra dentro do CRM de um cliente.
 *
 * Agora o link carrega um token aleatório de 32 bytes, e o banco guarda só o HASH dele: mesma
 * regra da senha e do "esqueci minha senha". Vazar o banco não devolve nenhum token utilizável, e
 * o convite morre sozinho depois do prazo.
 */

/** Sete dias. Tempo de sobra pra alguém aceitar um convite; curto o bastante pra um link esquecido
 * numa caixa de entrada antiga não valer pra sempre. */
export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

export function gerarTokenConvite(): string {
  return randomBytes(32).toString("hex");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Confere o token do link contra o hash guardado, em tempo constante.
 *
 * Comparar com `===` vaza pelo tempo de resposta quantos caracteres do começo bateram, o que
 * permite descobrir o valor tentativa a tentativa.
 */
export function tokenConfere(token: string | null | undefined, hashGuardado: string | null | undefined): boolean {
  if (!token || !hashGuardado) return false;
  const esperado = Buffer.from(hashGuardado);
  const recebido = Buffer.from(hashDoToken(token));
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** O convite está de pé? Pendente, com token conferido e dentro do prazo. */
export function conviteValido(
  membro: { convitePendente: boolean; conviteTokenHash: string | null; conviteExpiraEm: Date | null } | null,
  token: string | null | undefined,
): boolean {
  if (!membro || !membro.convitePendente) return false;
  if (!tokenConfere(token, membro.conviteTokenHash)) return false;
  // Convite antigo, criado antes do token existir, não tem prazo gravado: recusa. O admin reenvia
  // e o novo já nasce com token e validade. Aceitar "sem prazo" manteria aberta justamente a porta
  // que esta mudança fecha.
  if (!membro.conviteExpiraEm || membro.conviteExpiraEm < new Date()) return false;
  return true;
}
