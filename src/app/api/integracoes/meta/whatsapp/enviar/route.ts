import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  contaConectada,
  enviarPelaCloudApi,
  janelaDeAtendimentoAberta,
  tratarErroEnvio,
} from "@/lib/integracoes/whatsapp-oficial";

type ContatoPayload = {
  nome: string;
  whatsapp?: string;
  telefoneFixo?: string;
  email?: string;
  empresa?: string;
  cargo?: string;
};

/**
 * POST manda uma mensagem de verdade pelo WhatsApp Business oficial (Meta) conectado — chamada
 * pela tela de Conversas quando o atendente responde numa conversa que NÃO é do canal
 * `whatsapp_baileys` (ver `contatoUsaWhatsappBaileys()` em conversas/page.tsx). Antes desta rota
 * existir, o envio pelo canal oficial só atualizava o estado local — nunca chamava a Graph API,
 * então a mensagem nunca saía de verdade. Aceita `texto` (mensagem normal) OU `contato`
 * (cartão/vCard, `type: "contacts"` da Graph API) — nunca os dois juntos.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto, contato, contatoNome, template } = (await request.json()) as {
    destinatario?: string;
    texto?: string;
    contato?: ContatoPayload;
    /** Nome da conversa no CRM — usado pra checar a janela de 24h daquela pessoa. */
    contatoNome?: string;
    /** Modelo de mensagem aprovado, único jeito de falar com a janela de 24h fechada. */
    template?: { nome: string; idioma: string; componentes?: unknown[] };
  };
  if (!destinatario || (!texto?.trim() && !contato && !template)) {
    return NextResponse.json({ erro: "destinatario e texto (ou contato/template) são obrigatórios" }, { status: 400 });
  }

  const conta = await contaConectada(sessao.user.workspaceId);
  if (!conta) {
    return NextResponse.json({ erro: "WhatsApp Business (Meta) não conectado" }, { status: 404 });
  }

  // Janela de atendimento: passadas 24h da última mensagem recebida, a Cloud API só aceita modelo
  // aprovado. Barrar aqui dá um erro claro em português em vez do 131047 cru da Meta lá na frente.
  if (!template && contatoNome) {
    const janelaAberta = await janelaDeAtendimentoAberta(sessao.user.workspaceId, contatoNome);
    if (!janelaAberta) {
      return NextResponse.json(
        {
          erro: "Passaram mais de 24h desde a última mensagem dessa pessoa — pra falar agora só usando um modelo de mensagem aprovado.",
          precisaTemplate: true,
        },
        { status: 409 },
      );
    }
  }

  const corpoMensagem = template
    ? {
        type: "template",
        template: {
          name: template.nome,
          language: { code: template.idioma },
          ...(template.componentes?.length ? { components: template.componentes } : {}),
        },
      }
    : contato
      ? {
          type: "contacts",
          contacts: [
            {
              name: { formatted_name: contato.nome, first_name: contato.nome.split(" ")[0] },
              phones: [
                ...(contato.whatsapp ? [{ phone: contato.whatsapp, type: "CELL" }] : []),
                ...(contato.telefoneFixo ? [{ phone: contato.telefoneFixo, type: "WORK" }] : []),
              ],
              ...(contato.email ? { emails: [{ email: contato.email, type: "WORK" }] } : {}),
              ...(contato.empresa || contato.cargo
                ? { org: { company: contato.empresa, title: contato.cargo } }
                : {}),
            },
          ],
        }
      : { type: "text", text: { body: texto } };

  try {
    // `wamid` volta pra quem chamou porque é ele que casa os webhooks de entrega/leitura com esta
    // mensagem — sem guardar isso, `statuses` do webhook não encontram nada pra atualizar.
    const wamid = await enviarPelaCloudApi(conta, destinatario, corpoMensagem);
    return NextResponse.json({ ok: true, wamid });
  } catch (erro) {
    const mensagemErro = await tratarErroEnvio(erro, conta.integracaoId);
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
