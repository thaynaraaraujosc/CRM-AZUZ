import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/seguranca/auditoria";
import { desconectarWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { limparDadosDoWhatsApp } from "@/lib/integracoes/limpar-dados-whatsapp";

/** POST pede pra Evolution API encerrar a sessão do workspace de quem está logado. Atualiza o
 * status no banco na hora (não espera o webhook de `connection.update` confirmar, pra tela reagir
 * imediato ao clique). O logout remoto é best-effort: se a sessão já caiu do lado do celular (ou
 * a Evolution já não reconhece mais a instância como conectada), a chamada de logout pode falhar
 * mesmo o objetivo final ("desconectado") já sendo verdade. Não deixa isso travar o usuário com
 * "Conectado" pra sempre no CRM sem conseguir desconectar. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // Conectar e desconectar um canal é ação de dono da conta: desconectar o WhatsApp derruba o
  // atendimento da empresa inteira, e conectar outro número redireciona por onde as mensagens
  // saem. Antes bastava estar logado, e qualquer membro comum fazia as duas coisas.
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem mexer nas conexões." }, { status: 403 });
  }

  // Conectar e desconectar um canal muda por onde a empresa inteira fala com os clientes. Sem
  // registro, "quem desconectou o WhatsApp?" não tinha resposta.
  await auditar({ acao: "integracao.desconectada", workspaceId: sessao.user.workspaceId, membroId: sessao.user.id, email: sessao.user.email, recurso: "whatsapp_nao_oficial" });

  const workspaceId = sessao.user.workspaceId;
  // `limparDados` vem do clique de quem já confirmou na tela o que vai ser apagado. Nunca é o
  // padrão, porque é irreversível.
  const { limparDados } = await request
    .json()
    .then((corpo: { limparDados?: boolean }) => corpo)
    .catch(() => ({ limparDados: false }));

  await desconectarWhatsAppNaoOficial(workspaceId).catch((erro) => {
    console.error("Falha ao encerrar sessão na Evolution API (seguindo para desconectar localmente):", erro);
  });

  /*
   * O RASTRO DE WEBHOOK SOBREVIVE AO DESCONECTAR.
   *
   * `metadados` é uma coluna Json: o Prisma a substitui INTEIRA, não mescla campo a campo. Escrever
   * `{ qrDataUrl, numero }` apagava tudo o mais que vivia ali, e junto ia o `webhook` — o registro
   * de "a Evolution falou comigo às tal hora" e "chegou uma mensagem e o CRM descartou por este
   * motivo". É o único rastro que responde "por que essa mensagem não apareceu", e ele era
   * destruído exatamente no momento em que alguém, sem conseguir receber mensagem, desconecta e
   * reconecta pra tentar consertar. A informação de que mais se precisava sumia junto com a
   * tentativa de resolver. `atualizarStatus`, no webhook, já mescla por este mesmo motivo.
   *
   * `historico` continua sendo apagado de propósito: a importação é do celular que estava
   * conectado, e quem conectar depois pode ser outro número. Reimportar sem desconectar agora tem
   * caminho próprio ("Buscar conversas que faltam").
   */
  const atual = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  const webhook = ((atual?.metadados as Record<string, unknown> | null) ?? {}).webhook;

  await prisma.integracao.updateMany({
    where: { workspaceId, provedor: "whatsapp_nao_oficial" },
    data: {
      status: "desconectado",
      metadados: { qrDataUrl: null, numero: null, ...(webhook ? { webhook } : {}) },
    },
  });

  // Sem isso, o espelho do WhatsApp (contatos, cards no funil, pendências no Início, conversa
  // órfã) fica para trás depois de desconectar e se mistura com o do próximo canal conectado.
  const limpeza = limparDados ? await limparDadosDoWhatsApp(workspaceId, "nao_oficial") : null;

  return NextResponse.json({ ok: true, limpeza });
}
