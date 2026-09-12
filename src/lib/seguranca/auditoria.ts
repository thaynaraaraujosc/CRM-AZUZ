import { prisma } from "@/lib/prisma";
import { ipDeQuemChamou } from "@/lib/seguranca/limite-de-uso";

/**
 * Registro de auditoria: quem fez o quê, quando, e se deu certo.
 *
 * Não existia nada disso. Quando alguém pergunta "quem desativou esse usuário?", "quem
 * desconectou o WhatsApp da empresa?" ou "esse acesso foi mesmo da dona da conta?", a única
 * resposta possível era não saber. Investigação de incidente depende de existir registro ANTES do
 * incidente, e é tarde pra criar depois.
 *
 * REGRA QUE NÃO SE QUEBRA: nada sensível entra aqui. Nem senha, nem token, nem cookie de sessão,
 * nem corpo de mensagem de cliente. Um log de auditoria que guarda segredo deixa de ser defesa e
 * vira mais um lugar de onde vazar.
 *
 * Nunca lança e nunca atrasa a resposta: falha de auditoria não pode derrubar a ação em si. O
 * preço disso é que um registro pode se perder numa falha de banco, o que é o lado certo do
 * compromisso pra um CRM.
 */
export type AcaoAuditada =
  | "login.sucesso"
  | "login.recusado"
  | "login.bloqueado_por_tentativas"
  | "membro.convidado"
  | "membro.alterado"
  | "membro.excluido"
  | "membro.senha_resetada"
  | "convite.aceito"
  | "integracao.conectada"
  | "integracao.desconectada"
  | "campanha.criada"
  | "campanha.cancelada"
  | "dados.exportados"
  | "workspace.alterado";

type Entrada = {
  acao: AcaoAuditada;
  resultado?: "ok" | "recusado";
  workspaceId?: string | null;
  membroId?: string | null;
  email?: string | null;
  recurso?: string | null;
  detalhe?: string | null;
  /** Quando quem chama já está fora de um contexto de request (cron, worker), passa `null`. */
  ip?: string | null;
};

/** Teto do campo de contexto: um detalhe longo demais é ruído e custo de armazenamento. */
const MAXIMO_DETALHE = 500;

export async function auditar(entrada: Entrada): Promise<void> {
  try {
    const ip = entrada.ip === undefined ? await ipDeQuemChamou().catch(() => null) : entrada.ip;
    await prisma.registroDeAuditoria.create({
      data: {
        workspaceId: entrada.workspaceId ?? null,
        membroId: entrada.membroId ?? null,
        email: entrada.email ?? null,
        acao: entrada.acao,
        recurso: entrada.recurso ?? null,
        resultado: entrada.resultado ?? "ok",
        detalhe: entrada.detalhe?.slice(0, MAXIMO_DETALHE) ?? null,
        ip: ip ?? null,
      },
    });
  } catch (erro) {
    // Nunca derruba a ação auditada. Só avisa no log do servidor que o registro se perdeu.
    console.error("[auditoria] falha ao registrar:", erro instanceof Error ? erro.message : erro);
  }
}

/**
 * Os campos que mudaram, sem os valores.
 *
 * É o que permite responder "quem mexeu no papel desse usuário?" sem guardar o conteúdo de nada.
 * Guardar o antes e o depois seria cópia de dado pessoal num segundo lugar, com outra vida útil.
 */
export function camposAlterados(antes: Record<string, unknown>, depois: Record<string, unknown>): string {
  const mudaram = Object.keys(depois).filter(
    (campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]),
  );
  return mudaram.length ? mudaram.join(", ") : "nada";
}
