import { prisma } from "@/lib/prisma";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";
import { prepararEnvioDeModelo, usaReuniao, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { proximaReuniaoDoContato } from "@/lib/agenda/proxima-reuniao";
import { modeloDeRetomada } from "./retomada";

/**
 * Manda o modelo de retomada quando a janela de 24 horas fechou.
 *
 * Devolve `null` quando não há modelo escolhido: aí quem chamou segue com a explicação de sempre.
 * Um erro no envio do modelo vira motivo em português, não exceção: a automação precisa registrar o
 * que houve, não estourar no meio.
 */
export async function enviarModeloDeRetomada(params: {
  workspaceId: string;
  conversaNome: string;
  destinatario: string;
}): Promise<{ enviado: boolean; motivo?: string; wamid?: string | null } | null> {
  const { workspaceId, conversaNome, destinatario } = params;
  const modelo = await modeloDeRetomada(workspaceId);
  if (!modelo) return null;

  const conta = await contaConectada(workspaceId);
  if (!conta) return { enviado: false, motivo: "WhatsApp oficial não conectado." };

  try {
    const registro = await prisma.template.findFirst({ where: { id: modelo.id, workspaceId } });
    const contato = await prisma.contato.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
    });
    const mapeamento = ((registro?.variaveis ?? []) as MapeamentoVariavel[]) ?? [];
    const reuniao = usaReuniao(mapeamento) ? await proximaReuniaoDoContato(workspaceId, conversaNome) : null;
    // Mesma regra do bloco de automação: a Meta recusa o envio inteiro por um parâmetro vazio, e
    // aqui a janela já fechou — o modelo de retomada é a última chance de falar com a pessoa.
    const preparo = prepararEnvioDeModelo(mapeamento, contato ? { ...contato, nome: conversaNome, reuniao } : null);
    if (!preparo.ok) {
      return { enviado: false, motivo: `a janela de 24 horas fechou e ${preparo.motivo}` };
    }

    const wamid = await enviarPelaCloudApi(conta, destinatario, {
      type: "template",
      template: {
        name: modelo.nome,
        language: { code: modelo.idioma },
        components: preparo.componentes,
      },
    });
    return { enviado: true, wamid };
  } catch (erro) {
    return {
      enviado: false,
      motivo: `a janela de 24 horas fechou e o modelo de retomada "${modelo.nome}" também não saiu: ${
        erro instanceof Error ? erro.message : "falha no envio"
      }`,
    };
  }
}
