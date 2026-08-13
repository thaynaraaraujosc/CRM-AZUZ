import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de curta duração (1 minuto — só o tempo de ser usado uma vez, na hora) que autoriza
 * "entrar como" um membro específico, sem senha nenhuma. Reaproveita `AUTH_SECRET` (o mesmo
 * segredo que o NextAuth já usa pra assinar a sessão) em vez de inventar mais uma env var — dá no
 * mesmo, é um segredo do servidor que só ele conhece.
 *
 * `superAdminId` viaja dentro do token quando é o super-admin começando a impersonar alguém —
 * assim o provider "impersonar" (`auth.ts`) devolve esse id junto na sessão do usuário
 * impersonado, e o botão "Voltar pro admin" sabe pra quem voltar sem precisar de senha de novo
 * (chama esse mesmo mecanismo ao contrário, sem `superAdminId`).
 */
function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return s;
}

export function gerarTokenImpersonar(membroId: string, superAdminId?: string): string {
  const exp = Date.now() + 60_000;
  const payload = `${membroId}:${superAdminId ?? ""}:${exp}`;
  const assinatura = createHmac("sha256", segredo()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${assinatura}`).toString("base64url");
}

export function verificarTokenImpersonar(token: string): { membroId: string; superAdminId: string | null } | null {
  try {
    const decodificado = Buffer.from(token, "base64url").toString("utf8");
    const partes = decodificado.split(":");
    if (partes.length !== 4) return null;
    const [membroId, superAdminId, expStr, assinatura] = partes;

    const payload = `${membroId}:${superAdminId}:${expStr}`;
    const esperada = createHmac("sha256", segredo()).update(payload).digest("hex");
    const bufRecebida = Buffer.from(assinatura);
    const bufEsperada = Buffer.from(esperada);
    if (bufRecebida.length !== bufEsperada.length || !timingSafeEqual(bufRecebida, bufEsperada)) return null;

    if (Date.now() > Number(expStr)) return null;
    if (!membroId) return null;

    return { membroId, superAdminId: superAdminId || null };
  } catch {
    return null;
  }
}
