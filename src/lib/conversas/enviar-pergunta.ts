import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { enviarDirectComRespostasRapidas } from "@/lib/integracoes/instagram-login";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";

/**
 * Manda uma pergunta com opções pelo canal da conversa, no melhor formato que aquele canal
 * REALMENTE suporta.
 *
 * O bloco "mensagem com botões" existia só no editor: no envio, virava texto. E cada canal tem um
 * teto diferente — não é escolha de gosto, é o que a API aceita:
 *
 * - **WhatsApp oficial**: até 3 botões (`interactive.button`), título de 20 caracteres. De 4 a 10
 *   opções só cabe em lista (`interactive.list`). Acima disso, nenhum formato interativo existe.
 * - **Instagram**: respostas rápidas (`quick_replies`), até 13, título de 20 caracteres.
 * - **WhatsApp por QR Code (Baileys)**: botão não é confiável — o WhatsApp derruba botão vindo de
 *   conexão não oficial, e a pessoa receberia uma mensagem vazia. Aqui vai menu numerado, que
 *   funciona em qualquer conexão.
 *
 * Quando não cabe no formato interativo, cai no menu numerado em vez de falhar: a pergunta chega,
 * e `saidaDaResposta` já entende o número. O formato usado volta no retorno pra ficar no histórico
 * — a pessoa precisa saber que aquele fluxo saiu numerado, não em botões.
 */
export type FormatoEnviado = "botoes" | "lista" | "respostas_rapidas" | "numerado";

export type OpcaoPergunta = { id: string; rotulo: string };

export type ResultadoPergunta = {
  enviado: boolean;
  formato: FormatoEnviado;
  motivo?: string;
  /** Por que não foi no formato interativo, quando não foi. Vai pro histórico. */
  observacao?: string;
};

/** Teto de caracteres do rótulo nos formatos interativos da Meta (botão, item de lista, resposta rápida). */
export const MAX_ROTULO = 20;

/** Encurta o rótulo pro teto do canal. Exportado porque a leitura da resposta precisa comparar
 * contra o MESMO texto que foi enviado — a pessoa clica no botão encurtado. */
export function rotuloCurto(rotulo: string, max = MAX_ROTULO): string {
  const limpo = rotulo.trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1)}…`;
}

/** O menu numerado: a pergunta seguida de "1 - …", "2 - …". Funciona em qualquer canal. */
export function textoNumerado(texto: string, opcoes: OpcaoPergunta[]): string {
  if (!opcoes.length) return texto;
  return `${texto}\n\n${opcoes.map((o, i) => `${i + 1} - ${o.rotulo}`).join("\n")}`;
}

export async function enviarPerguntaPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  texto: string;
  opcoes: OpcaoPergunta[];
}): Promise<ResultadoPergunta> {
  const { workspaceId, conversaNome, texto, opcoes } = params;
  if (!texto.trim()) return { enviado: false, formato: "numerado", motivo: "mensagem vazia" };

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
  });
  if (!conversa?.contato) return { enviado: false, formato: "numerado", motivo: "conversa sem destinatário" };
  if (conversa.ehGrupo) return { enviado: false, formato: "numerado", motivo: "conversa de grupo" };

  try {
    if (conversa.canal === "Instagram") {
      const integracao = await prisma.integracao.findUnique({
        where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
      });
      if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
        return { enviado: false, formato: "numerado", motivo: "Instagram não conectado" };
      }
      const token = decriptar(integracao.accessTokenCriptografado);
      if (opcoes.length && opcoes.length <= 13) {
        await enviarDirectComRespostasRapidas(
          token,
          conversa.contato,
          texto,
          opcoes.map((o) => ({ id: o.id, titulo: rotuloCurto(o.rotulo) })),
        );
        return { enviado: true, formato: "respostas_rapidas" };
      }
      await enviarDirectComRespostasRapidas(token, conversa.contato, textoNumerado(texto, opcoes), []);
      return {
        enviado: true,
        formato: "numerado",
        observacao: opcoes.length > 13 ? "mais de 13 opções — o Instagram não aceita, foi menu numerado" : undefined,
      };
    }

    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");
    if (porQrCode) {
      await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, textoNumerado(texto, opcoes));
      return {
        enviado: true,
        formato: "numerado",
        observacao: opcoes.length ? "conexão por QR Code não entrega botão — foi menu numerado" : undefined,
      };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, formato: "numerado", motivo: "WhatsApp não conectado" };

    if (opcoes.length && opcoes.length <= 3) {
      await enviarPelaCloudApi(conta, conversa.contato, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: texto },
          action: {
            buttons: opcoes.map((o) => ({ type: "reply", reply: { id: o.id, title: rotuloCurto(o.rotulo) } })),
          },
        },
      });
      return { enviado: true, formato: "botoes" };
    }

    if (opcoes.length && opcoes.length <= 10) {
      await enviarPelaCloudApi(conta, conversa.contato, {
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: texto },
          action: {
            button: "Ver opções",
            sections: [
              { title: "Opções", rows: opcoes.map((o) => ({ id: o.id, title: rotuloCurto(o.rotulo, 24) })) },
            ],
          },
        },
      });
      return { enviado: true, formato: "lista", observacao: "mais de 3 opções — foi lista, não botões" };
    }

    await enviarPelaCloudApi(conta, conversa.contato, { type: "text", text: { body: textoNumerado(texto, opcoes) } });
    return {
      enviado: true,
      formato: "numerado",
      observacao: opcoes.length ? "mais de 10 opções — nenhum formato interativo cabe, foi menu numerado" : undefined,
    };
  } catch (erro) {
    return { enviado: false, formato: "numerado", motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}
