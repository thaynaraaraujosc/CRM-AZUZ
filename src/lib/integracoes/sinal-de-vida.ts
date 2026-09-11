import { prisma } from "@/lib/prisma";

/**
 * O registro de que a Evolution ainda está falando com o CRM.
 *
 * Existe por causa de um sintoma que não tinha como ser investigado: "a mensagem chegou no meu
 * celular e não chegou aqui". Até aqui o CRM não guardava nenhum rastro de webhook recebido, então
 * as duas causas possíveis (a Evolution não chamou; ou chamou e a mensagem foi descartada no
 * caminho) eram indistinguíveis, e a única saída era adivinhar.
 *
 * Fica em `Integracao.metadados.webhook`, junto do resto da conexão, pra não precisar de tabela
 * nova. Barato de propósito: uma escrita por minuto no caso do sinal de vida (mensagem chega em
 * rajada, e gravar "chegou" a cada uma seria escrita à toa), e uma por descarte (que é raro, e
 * quando acontece é exatamente o que se quer ver).
 */
export type RegistroDeWebhook = {
  ultimoEventoEm?: string;
  ultimoEvento?: string;
  ultimoDescarte?: { motivo: string; em: string; detalhe?: string };
};

const INTERVALO_SINAL_MS = 60 * 1000;

async function lerRegistro(workspaceId: string, provedor: string) {
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor } },
    select: { metadados: true },
  });
  if (!linha) return null;
  const metadados = (linha.metadados as Record<string, unknown> | null) ?? {};
  return { metadados, webhook: (metadados.webhook as RegistroDeWebhook | undefined) ?? {} };
}

async function gravar(workspaceId: string, provedor: string, webhook: RegistroDeWebhook, metadados: Record<string, unknown>) {
  await prisma.integracao
    .update({
      where: { workspaceId_provedor: { workspaceId, provedor } },
      data: { metadados: { ...metadados, webhook } },
    })
    // Integração ainda não existe (evento antes da conexão ser gravada): não é erro, não há o que
    // anotar. Nunca pode derrubar o processamento da mensagem, que é o que importa de verdade.
    .catch(() => {});
}

/** "A Evolution falou com a gente agora." Escreve no máximo uma vez por minuto. */
export async function registrarSinalDeVida(workspaceId: string, evento: string, provedor = "whatsapp_nao_oficial") {
  const atual = await lerRegistro(workspaceId, provedor);
  if (!atual) return;
  const ultimo = atual.webhook.ultimoEventoEm ? Date.parse(atual.webhook.ultimoEventoEm) : 0;
  if (Date.now() - ultimo < INTERVALO_SINAL_MS) return;
  await gravar(
    workspaceId,
    provedor,
    { ...atual.webhook, ultimoEventoEm: new Date().toISOString(), ultimoEvento: evento },
    atual.metadados,
  );
}

/** "Chegou, e o CRM jogou fora, por este motivo." O contrário do sinal de vida: sempre grava,
 * porque descarte é raro e é justamente o que se procura quando uma mensagem some. */
export async function registrarDescarte(
  workspaceId: string,
  motivo: string,
  detalhe?: string,
  provedor = "whatsapp_nao_oficial",
) {
  const atual = await lerRegistro(workspaceId, provedor);
  if (!atual) return;
  await gravar(
    workspaceId,
    provedor,
    { ...atual.webhook, ultimoDescarte: { motivo, em: new Date().toISOString(), ...(detalhe ? { detalhe } : {}) } },
    atual.metadados,
  );
}
