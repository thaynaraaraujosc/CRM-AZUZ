import { prisma } from "@/lib/prisma";

/**
 * Uma conversa do Instagram cujo nome ainda é o id interno da thread — só dígitos, algo como
 * `3984605438508218`.
 *
 * Acontece quando a busca do @ falha na primeira mensagem (perfil sem permissão, API fora do ar):
 * o CRM cai no id pra não perder a mensagem, e a conversa nasce com um número no lugar do nome. Sem
 * uma segunda tentativa, esse número ficaria pra sempre — foi o que apareceu na caixa de entrada.
 */
export function nomeAindaEhIdCru(nome: string | null | undefined): boolean {
  return !!nome && /^\d{5,}$/.test(nome);
}

/**
 * Troca o nome de uma conversa e leva as mensagens junto.
 *
 * As mensagens são casadas com a conversa pelo NOME (`MensagemExtra.contato`), não por uma FK — então
 * renomear só a conversa deixaria o histórico órfão, invisível na tela. As duas coisas mudam na
 * mesma transação, ou nenhuma muda.
 *
 * Se já existir uma conversa com o nome novo (a mesma pessoa escreveu de novo e dessa vez o @
 * resolveu, criando uma segunda thread), as mensagens são movidas pra ela e a que estava com o
 * número é removida — o resultado é uma conversa só, que é o que a pessoa espera ver.
 */
export async function renomearConversa(workspaceId: string, de: string, para: string): Promise<void> {
  if (de === para) return;

  const jaExisteDestino = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: para } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.mensagemExtra.updateMany({ where: { workspaceId, contato: de }, data: { contato: para } }),
    ...(jaExisteDestino
      ? [prisma.conversa.deleteMany({ where: { workspaceId, nome: de } })]
      : [
          prisma.conversa.updateMany({
            where: { workspaceId, nome: de },
            data: { nome: para, initials: iniciaisDe(para) },
          }),
        ]),
  ]);
}

function iniciaisDe(nome: string): string {
  // O @ não entra nas iniciais: "@fulana" viraria "@" e a bolinha da lista ficaria com um arroba
  // no lugar da letra.
  const limpo = nome.replace(/^@/, "");
  return (
    limpo
      .split(/[\s._]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}
