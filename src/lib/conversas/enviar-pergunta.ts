import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { enviarDirectComRespostasRapidas } from "@/lib/integracoes/instagram-login";
import { contaConectada, enviarPelaCloudApi, janelaDeAtendimentoAberta } from "@/lib/integracoes/whatsapp-oficial";
import { enviarTextoPeloCanal } from "./enviar-pelo-canal";

/**
 * Manda uma pergunta com opções pelo canal da conversa, no melhor formato que aquele canal
 * REALMENTE suporta.
 *
 * O bloco "mensagem com botões" existia só no editor: no envio, virava texto. E cada canal tem um
 * teto diferente: não é escolha de gosto, é o que a API aceita:
 *
 * - **WhatsApp oficial**: até 3 botões (`interactive.button`), título de 20 caracteres. De 4 a 10
 *   opções só cabe em lista (`interactive.list`). Acima disso, nenhum formato interativo existe.
 * - **Instagram**: respostas rápidas (`quick_replies`), até 13, título de 20 caracteres.
 * - **WhatsApp por QR Code (Baileys)**: botão não é confiável: o WhatsApp derruba botão vindo de
 *   conexão não oficial, e a pessoa receberia uma mensagem vazia. Aqui vai menu numerado, que
 *   funciona em qualquer conexão.
 *
 * Quando não cabe no formato interativo, cai no menu numerado em vez de falhar: a pergunta chega,
 * e `saidaDaResposta` já entende o número. O formato usado volta no retorno pra ficar no histórico
 *. A pessoa precisa saber que aquele fluxo saiu numerado, não em botões.
 */
export type FormatoEnviado = "botoes" | "lista" | "respostas_rapidas" | "numerado";

export type OpcaoPergunta = {
  id: string;
  rotulo: string;
  /** Botão de URL: a opção leva a um endereço em vez de esperar resposta. */
  url?: string;
};

export type ResultadoPergunta = {
  enviado: boolean;
  formato: FormatoEnviado;
  motivo?: string;
  /** Por que não foi no formato interativo, quando não foi. Vai pro histórico. */
  observacao?: string;
  /**
   * O id que a Meta devolve no envio.
   *
   * É por ele que o webhook de status acha a bolha depois pra dizer "entregue", "lido" ou
   * "FALHOU". Sem guardar, a mensagem ficava com o tique de enviada pra sempre mesmo quando a Meta
   * avisava minutos depois que a entrega falhou: a tela dizia que a automação tinha mandado e o
   * celular da pessoa nunca recebia. Nulo no QR Code, que não tem id equivalente.
   */
  wamid?: string | null;
};

/** Teto de caracteres do rótulo nos formatos interativos da Meta (botão, item de lista, resposta rápida). */
export const MAX_ROTULO = 20;

/** Encurta o rótulo pro teto do canal. Exportado porque a leitura da resposta precisa comparar
 * contra o MESMO texto que foi enviado. A pessoa clica no botão encurtado. */
export function rotuloCurto(rotulo: string, max = MAX_ROTULO): string {
  const limpo = rotulo.trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1)}…`;
}

/** O menu numerado: a pergunta seguida de "1 - …", "2 - …". Funciona em qualquer canal. */
export function textoNumerado(texto: string, opcoes: OpcaoPergunta[]): string {
  if (!opcoes.length) return texto;
  // A opção com endereço leva o endereço junto: é o único jeito de a pessoa chegar no link, já
  // que nenhum destes canais manda botão de URL por aqui.
  const linhas = opcoes.map((o, i) => (o.url ? `${i + 1} - ${o.rotulo}: ${o.url}` : `${i + 1} - ${o.rotulo}`));
  return `${texto}\n\n${linhas.join("\n")}`;
}

/**
 * Uma opção com endereço não cabe em botão interativo aqui, e misturar formatos deixaria metade
 * das opções invisível. Com qualquer uma delas, a pergunta inteira sai numerada.
 */
function temBotaoDeUrl(opcoes: OpcaoPergunta[]): boolean {
  return opcoes.some((o) => !!o.url?.trim());
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
      if (opcoes.length && opcoes.length <= 13 && !temBotaoDeUrl(opcoes)) {
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
        observacao: opcoes.length > 13 ? "mais de 13 opções: o Instagram não aceita, foi menu numerado" : undefined,
      };
    }

    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");
    if (porQrCode) {
      await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, textoNumerado(texto, opcoes));
      return {
        enviado: true,
        formato: "numerado",
        observacao: opcoes.length ? "conexão por QR Code não entrega botão. Foi menu numerado" : undefined,
      };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, formato: "numerado", motivo: "WhatsApp não conectado" };

    /*
     * A JANELA DE 24 HORAS, conferida antes de tentar. Igual ao envio de texto.
     *
     * Faltava aqui, e a pergunta com botões é justamente o bloco que abre conversa. Fora da janela
     * a Meta recusa texto livre e formato interativo, e a recusa chegava como erro técnico em
     * inglês, difícil de ligar à causa. Aqui a explicação já vem certa e a chamada nem sai.
     */
    if (!(await janelaDeAtendimentoAberta(workspaceId, conversaNome))) {
      return {
        enviado: false,
        formato: "numerado",
        motivo:
          "a janela de 24 horas do WhatsApp fechou. Fora dela a Meta só aceita modelo aprovado: troque este bloco por “Enviar modelo do WhatsApp” ou mova o envio pra dentro das 24 horas.",
      };
    }

    if (opcoes.length && opcoes.length <= 3 && !temBotaoDeUrl(opcoes)) {
      const wamid = await enviarPelaCloudApi(conta, conversa.contato, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: texto },
          action: {
            buttons: opcoes.map((o) => ({ type: "reply", reply: { id: o.id, title: rotuloCurto(o.rotulo) } })),
          },
        },
      });
      return { enviado: true, formato: "botoes", wamid };
    }

    if (opcoes.length && opcoes.length <= 10 && !temBotaoDeUrl(opcoes)) {
      const wamid = await enviarPelaCloudApi(conta, conversa.contato, {
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
      return { enviado: true, formato: "lista", observacao: "mais de 3 opções: foi lista, não botões", wamid };
    }

    const wamid = await enviarPelaCloudApi(conta, conversa.contato, {
      type: "text",
      text: { body: textoNumerado(texto, opcoes) },
    });
    return {
      enviado: true,
      formato: "numerado",
      observacao: opcoes.length ? "mais de 10 opções: nenhum formato interativo cabe, foi menu numerado" : undefined,
      wamid,
    };
  } catch (erro) {
    return { enviado: false, formato: "numerado", motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}


/**
 * Envia uma LOCALIZAÇÃO pelo canal da conversa.
 *
 * Só o WhatsApp tem tipo próprio pra isso (um cartão com mapa). O Instagram não tem: lá a
 * localização vira um link do Google Maps, que é o que a pessoa faria à mão de qualquer jeito.
 */
export async function enviarLocalizacaoPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  latitude: number;
  longitude: number;
  nome?: string;
  endereco?: string;
}): Promise<{ enviado: boolean; motivo?: string; comoTexto?: boolean }> {
  const { workspaceId, conversaNome, latitude, longitude } = params;
  const conversa = await prisma.conversa.findUnique({ where: { workspaceId_nome: { workspaceId, nome: conversaNome } } });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  const link = `https://maps.google.com/?q=${latitude},${longitude}`;
  const comoTexto = [params.nome, params.endereco, link].filter(Boolean).join("\n");

  try {
    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");

    if (conversa.canal === "Instagram" || porQrCode) {
      // Instagram não tem mensagem de localização, e no QR Code o formato não é confiável. O link
      // do mapa abre igual e não corre o risco de chegar vazio.
      const r = await enviarTextoPeloCanal({ workspaceId, conversaNome, texto: comoTexto });
      return { enviado: r.enviado, motivo: r.motivo, comoTexto: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };
    await enviarPelaCloudApi(conta, conversa.contato, {
      type: "location",
      location: {
        latitude,
        longitude,
        ...(params.nome ? { name: params.nome } : {}),
        ...(params.endereco ? { address: params.endereco } : {}),
      },
    });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}

/**
 * Envia um CARTÃO DE CONTATO pelo canal da conversa.
 *
 * O WhatsApp oficial tem o tipo `contacts`, que chega como cartão salvável na agenda. Nos outros
 * canais vira texto com nome e telefone. Perde o cartão, mas a informação chega, que é o ponto.
 */
export async function enviarContatoPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  nome: string;
  telefone?: string;
  email?: string;
  empresa?: string;
}): Promise<{ enviado: boolean; motivo?: string; comoTexto?: boolean }> {
  const { workspaceId, conversaNome } = params;
  const conversa = await prisma.conversa.findUnique({ where: { workspaceId_nome: { workspaceId, nome: conversaNome } } });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  const comoTexto = [params.nome, params.empresa, params.telefone, params.email].filter(Boolean).join("\n");

  try {
    const porQrCode =
      conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:");

    if (conversa.canal === "Instagram" || porQrCode) {
      const r = await enviarTextoPeloCanal({ workspaceId, conversaNome, texto: comoTexto });
      return { enviado: r.enviado, motivo: r.motivo, comoTexto: true };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };
    await enviarPelaCloudApi(conta, conversa.contato, {
      type: "contacts",
      contacts: [
        {
          name: { formatted_name: params.nome, first_name: params.nome.split(" ")[0] },
          ...(params.telefone ? { phones: [{ phone: params.telefone, type: "CELL" }] } : {}),
          ...(params.email ? { emails: [{ email: params.email, type: "WORK" }] } : {}),
          ...(params.empresa ? { org: { company: params.empresa } } : {}),
        },
      ],
    });
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}
