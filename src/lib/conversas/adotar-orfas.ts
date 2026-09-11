import { prisma } from "@/lib/prisma";
import { provedorDoCanal } from "@/lib/integracoes/conta-canal";

/**
 * Devolve às conversas as mensagens que estão gravadas mas não aparecem.
 *
 * Toda mensagem carrega de qual conexão ela é: é isso que faz a caixa de entrada esvaziar ao
 * desconectar um número e voltar inteira ao reconectar. As mensagens que o CRM ENVIAVA nasciam sem
 * essa marca, porque o navegador não sabe por qual número a conversa fala, e ficavam gravadas e
 * invisíveis. O defeito já está corrigido para as novas.
 *
 * Isto aqui conserta as que ficaram para trás. Era um botão em Configurações, e botão de manutenção
 * dentro do produto não é conserto, é uma conta a pagar pelo cliente: ninguém que compra um CRM
 * deve precisar apertar um botão pra ver as próprias mensagens. Agora roda sozinho, pelo relógio.
 *
 * É seguro repetir quantas vezes for:
 *
 * - só adota mensagem cuja CONVERSA já tem dono. Conversa sem marca é histórico antigo do QR Code e
 *   deve mesmo seguir escondido enquanto aquela conexão não voltar: adotá-la seria ressuscitar na
 *   tela mensagem de um número desconectado;
 * - só preenche foto de contato que está sem foto, pra nunca sobrescrever uma escolhida à mão.
 */
/** Os nomes de `canal` que pertencem a um provedor. `whatsapp_baileys` é o nome antigo do QR
 * Code e ainda está gravado em mensagem de saída. */
function canaisDoProvedor(provedor: string): string[] {
  return ["whatsapp_baileys", provedor].filter((c) => provedorDoCanal(c) === provedorDoCanal(provedor));
}

export async function adotarMensagensOrfas(workspaceId: string): Promise<{
  adotadas: number;
  aindaOrfas: number;
  fotosCopiadas: number;
}> {
  const conversas = await prisma.conversa.findMany({
    where: { workspaceId, contaCanal: { not: null } },
    select: { nome: true, contaCanal: true },
  });

  let adotadas = 0;
  for (const conversa of conversas) {
    const provedorDaConversa = conversa.contaCanal!.split(":")[0];
    const { count } = await prisma.mensagemExtra.updateMany({
      where: {
        workspaceId,
        contato: conversa.nome,
        contaCanal: null,
        /*
         * Nunca adotar mensagem que entrou por OUTRA conexão.
         *
         * Este era o defeito: a adoção copiava o dono da conversa pra dentro das mensagens sem
         * olhar o `canal` de cada uma. Uma conversa que pertencia à API oficial carimbava como
         * oficial mensagem que tinha chegado pelo QR Code. Enquanto as duas estavam ligadas
         * ninguém via diferença; ao desconectar a oficial, essas mensagens sumiram da tela com o
         * número que as recebeu ainda conectado.
         *
         * `canal` nulo continua sendo adotado: é a mensagem de saída gravada antes dessa coluna
         * existir, que não diz de onde veio e é justamente o que esta função nasceu pra consertar.
         */
        OR: [
          { canal: null },
          { canal: { in: canaisDoProvedor(provedorDaConversa) } },
        ],
      },
      data: { contaCanal: conversa.contaCanal },
    });
    adotadas += count;
  }

  const aindaOrfas = await prisma.mensagemExtra.count({ where: { workspaceId, contaCanal: null } });

  // Aproveita a passada pra levar pros contatos as fotos que já estão nas conversas. É o que faz a
  // mesma pessoa aparecer com o mesmo rosto no funil e na lista de contatos, sem esperar ela mandar
  // mensagem de novo.
  const comFoto = await prisma.conversa.findMany({
    where: { workspaceId, fotoUrl: { not: null }, contatoId: { not: null } },
    select: { contatoId: true, fotoUrl: true },
  });
  let fotosCopiadas = 0;
  for (const conversa of comFoto) {
    const { count } = await prisma.contato.updateMany({
      where: { id: conversa.contatoId!, workspaceId, fotoUrl: null },
      data: { fotoUrl: conversa.fotoUrl },
    });
    fotosCopiadas += count;
  }

  return { adotadas, aindaOrfas, fotosCopiadas };
}

/**
 * Passa o reparo em todo workspace que ainda tem mensagem órfã.
 *
 * Uma consulta só descobre quem precisa, pelo índice `[workspaceId, contaCanal]`. No estado normal
 * (ninguém com órfã) ela volta vazia e a rodada custa isso e mais nada. Quem chama decide a
 * frequência: de hora em hora basta, porque mensagem órfã nova não existe mais.
 */
export async function adotarOrfasDeTodosOsWorkspaces(): Promise<{
  workspaces: number;
  adotadas: number;
}> {
  const pendentes = await prisma.mensagemExtra.groupBy({
    by: ["workspaceId"],
    where: { contaCanal: null },
    _count: { _all: true },
  });
  if (!pendentes.length) return { workspaces: 0, adotadas: 0 };

  let adotadas = 0;
  for (const linha of pendentes) {
    const r = await adotarMensagensOrfas(linha.workspaceId).catch((erro) => {
      console.error(`[orfas] falha no workspace ${linha.workspaceId}:`, erro);
      return { adotadas: 0, aindaOrfas: 0, fotosCopiadas: 0 };
    });
    adotadas += r.adotadas;
  }
  return { workspaces: pendentes.length, adotadas };
}
