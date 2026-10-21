import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";

/**
 * O disjuntor do canal: depois de N falhas seguidas, para tudo e chama alguém.
 *
 * O que ele previne não é a falha — é a INSISTÊNCIA. Um número bloqueado, uma instância caída ou um
 * token vencido fazem todo envio falhar; sem disjuntor, a fila continuaria tentando de minuto em
 * minuto, por horas, batendo numa porta fechada. É assim que uma conta que estava só instável vira
 * uma conta banida.
 *
 * E ele só volta por decisão de GENTE. Religar sozinho depois de um tempo seria repetir a mesma
 * insistência com outro nome, e esconderia o fato de que alguém precisa olhar o que aconteceu.
 *
 * O estado mora em `Preferencia`, não no arquivo de opções: isto não é uma escolha da empresa, é o
 * que está acontecendo com o canal agora.
 */

const CHAVE = "azuz-flow-disjuntor";

export type EstadoDoDisjuntor = {
  /** Quantas falhas seguidas até agora. Zera a cada envio que dá certo. */
  falhasSeguidas: number;
  /** Quando pausou. `null` = não está pausado. */
  pausadoEm: string | null;
  /** A última falha, pra tela poder dizer o que aconteceu. Sem dado de cliente dentro. */
  ultimoMotivo: string | null;
};

const ZERADO: EstadoDoDisjuntor = { falhasSeguidas: 0, pausadoEm: null, ultimoMotivo: null };

export async function lerDisjuntor(workspaceId: string): Promise<EstadoDoDisjuntor> {
  try {
    const linha = await prisma.preferencia.findUnique({
      where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
      select: { dados: true },
    });
    const dados = (linha?.dados ?? {}) as Record<string, unknown>;
    return {
      falhasSeguidas: typeof dados.falhasSeguidas === "number" ? dados.falhasSeguidas : 0,
      pausadoEm: typeof dados.pausadoEm === "string" ? dados.pausadoEm : null,
      ultimoMotivo: typeof dados.ultimoMotivo === "string" ? dados.ultimoMotivo : null,
    };
  } catch (erro) {
    // Não saber o estado não pode travar a fila nem soltá-la: `ZERADO` deixa o fluxo seguir e a
    // próxima falha volta a contar.
    console.error("[azuz-flow] não deu pra ler o disjuntor:", erro);
    return ZERADO;
  }
}

async function gravar(workspaceId: string, estado: EstadoDoDisjuntor): Promise<void> {
  await prisma.preferencia
    .upsert({
      where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
      create: { workspaceId, chave: CHAVE, dados: estado },
      update: { dados: estado },
    })
    .catch((erro) => console.error("[azuz-flow] não deu pra gravar o disjuntor:", erro));
}

/** Envio que deu certo: a contagem volta a zero. Uma falha isolada no meio de envios bons não é
 *  sintoma de nada, e somá-las ao longo de dias pausaria o canal por acaso. */
export async function registrarSucesso(workspaceId: string): Promise<void> {
  const estado = await lerDisjuntor(workspaceId);
  if (estado.falhasSeguidas === 0 && !estado.pausadoEm) return;
  await gravar(workspaceId, { ...ZERADO });
}

/**
 * Envio que falhou. Devolve `true` quando ESTA falha foi a que pausou o canal.
 *
 * O e-mail sai só na transição, nunca a cada falha seguinte: um disjuntor que manda e-mail em laço
 * é a própria insistência que ele existe pra impedir.
 */
export async function registrarFalha(params: {
  workspaceId: string;
  motivo: string;
  falhasParaPausar: number;
}): Promise<boolean> {
  const estado = await lerDisjuntor(params.workspaceId);
  if (estado.pausadoEm) return false;

  const falhasSeguidas = estado.falhasSeguidas + 1;
  const pausar = falhasSeguidas >= params.falhasParaPausar;

  await gravar(params.workspaceId, {
    falhasSeguidas,
    pausadoEm: pausar ? new Date().toISOString() : null,
    ultimoMotivo: params.motivo,
  });

  if (pausar) await avisarAdministradores(params.workspaceId, falhasSeguidas, params.motivo);
  return pausar;
}

/** Religa, por decisão de gente. */
export async function religarDisjuntor(workspaceId: string): Promise<void> {
  await gravar(workspaceId, { ...ZERADO });
}

/**
 * Avisa quem administra, por e-mail.
 *
 * Por que e-mail e não o sininho: o sininho do CRM é montado no navegador de quem está com a tela
 * aberta (ver `notificacoes-context.tsx`), e isto acontece num cron, sem ninguém logado. Mandar
 * pro sininho exigiria uma tabela de notificações que não existe. O e-mail chega de qualquer jeito,
 * e o cartão do AZUZ Flow mostra o aviso com o botão de religar pra quem entrar depois.
 *
 * Falha no e-mail não desfaz a pausa: a pausa é a proteção, o aviso é a cortesia.
 */
async function avisarAdministradores(workspaceId: string, falhas: number, motivo: string): Promise<void> {
  try {
    const admins = await prisma.membro.findMany({
      where: { workspaceId, papelTipo: "admin" },
      select: { email: true, nome: true },
    });
    if (!admins.length) return;

    const assunto = "CRM AZUZ: as confirmações de reunião foram pausadas";
    const corpo = `
      <p>As confirmações de reunião do AZUZ Flow foram <strong>pausadas automaticamente</strong> depois de
      ${falhas} falhas seguidas no envio.</p>
      <p>Último motivo: <em>${motivo}</em></p>
      <p>Nada foi perdido: as confirmações continuam na fila. Elas voltam a sair quando alguém religar,
      em Configurações › Integrações › AZUZ Flow.</p>
      <p>Isto existe pra proteger o número: insistir num canal que está recusando tudo é o caminho mais
      rápido pra ele ser bloqueado.</p>
    `;
    await Promise.all(admins.map((a) => enviarEmail({ to: a.email, subject: assunto, html: corpo })));
  } catch (erro) {
    console.error("[azuz-flow] disjuntor pausou mas o aviso não saiu:", erro);
  }
}
