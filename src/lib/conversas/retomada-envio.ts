import { prisma } from "@/lib/prisma";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";
import { prepararEnvioDeModelo, usaReuniao, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { proximaReuniaoDoContato } from "@/lib/agenda/proxima-reuniao";
import { botoesDoTemplateLocal, rotulosDosBotoes } from "@/lib/templates/botoes-do-template";
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
  /**
   * UM MODELO ESCOLHIDO PRA ESTE ENVIO, em vez do modelo de retomada geral.
   *
   * A retomada geral responde "o que dizer quando a janela fechou numa conversa qualquer" — uma
   * escolha única da empresa, feita uma vez em Configurações. A confirmação de um formulário é
   * outra pergunta: ela tem texto próprio, por formulário, e mandar a retomada genérica ali seria
   * responder "oi, podemos continuar?" pra quem acabou de marcar uma reunião.
   *
   * Ausente, nada muda: vale a retomada geral, como sempre.
   */
  templateId?: string | null;
}): Promise<{
  enviado: boolean;
  motivo?: string;
  wamid?: string | null;
  /**
   * Os botões que o modelo levou, pra bolha mostrar o que o cliente viu.
   *
   * Sem isto, o modelo saía COM o botão, o cliente via o botão, e o CRM registrava só o texto —
   * e a resposta "CONFIRMAR" aparecia do nada, logo abaixo, sem nada que explicasse de onde veio.
   */
  botoes?: string[];
} | null> {
  const { workspaceId, conversaNome, destinatario } = params;
  const modelo = params.templateId
    ? await modeloEscolhido(workspaceId, params.templateId)
    : await modeloDeRetomada(workspaceId);
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
    return { enviado: true, wamid, botoes: rotulosDosBotoes(botoesDoTemplateLocal(registro?.botoes)) };
  } catch (erro) {
    return {
      enviado: false,
      motivo: `a janela de 24 horas fechou e o modelo de retomada "${modelo.nome}" também não saiu: ${
        erro instanceof Error ? erro.message : "falha no envio"
      }`,
    };
  }
}

/**
 * O modelo que ESTE envio pediu, só se ele servir.
 *
 * Não aprovado é recusado pela Meta com erro genérico, e `null` aqui devolve o caminho de sempre —
 * que, fora da janela, é dizer com todas as letras que só sai modelo aprovado. Melhor isso do que
 * mandar a Meta recusar e traduzir o erro dela depois.
 */
async function modeloEscolhido(
  workspaceId: string,
  templateId: string,
): Promise<{ id: string; nome: string; idioma: string } | null> {
  const registro = await prisma.template.findFirst({
    where: { id: templateId, workspaceId, canal: "whatsapp_oficial", status: "aprovado" },
    select: { id: true, nome: true, idioma: true },
  });
  return registro ? { id: registro.id, nome: registro.nome, idioma: registro.idioma ?? "pt_BR" } : null;
}
