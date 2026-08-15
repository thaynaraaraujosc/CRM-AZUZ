import { randomBytes } from "node:crypto";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/l) — a senha vai ser lida em voz alta ou copiada por
 * alguém tentando resolver um problema de acesso, então evita confusão visual. Compartilhado entre
 * o reset de senha do super-admin (`/api/admin/membros/[id]/resetar-senha`) e o de admin de
 * workspace (`/api/equipe/[id]/resetar-senha`) — mesma necessidade, mesmo alfabeto. */
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function gerarSenhaAleatoria(tamanho = 12): string {
  const bytes = randomBytes(tamanho);
  let senha = "";
  for (let i = 0; i < tamanho; i++) senha += ALFABETO[bytes[i] % ALFABETO.length];
  return senha;
}
