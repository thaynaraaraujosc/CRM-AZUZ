import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ErroConexao,
  finalizarConexaoWhatsapp,
  salvarFalhaConexao,
} from "@/lib/integracoes/conectar-whatsapp-oficial";
import { chamarGraph } from "@/lib/integracoes/meta";

/**
 * Conexão DIRETA de uma conta do WhatsApp Business que já existe — a alternativa ao Embedded
 * Signup, para quem já tem a WABA criada e aprovada no próprio Business Manager.
 *
 * O Embedded Signup existe pra CRIAR a conta de um cliente de dentro do CRM, e exige que o app
 * esteja aprovado como Provedor de Tecnologia pela Meta (processo de dias). Quando a conta já
 * existe, nada disso é necessário: basta um token permanente de um usuário do sistema com acesso
 * à WABA. Daí em diante o fluxo é o mesmo dos dois lados (inscrever o app na WABA, registrar o
 * número, ler os metadados), então reaproveita `finalizarConexaoWhatsapp`.
 *
 * O token entra por aqui uma única vez, é validado contra a Graph API e sai criptografado pro
 * banco (`accessTokenCriptografado`). Nenhuma rota devolve ele de volta, nem parcialmente.
 */
type CorpoConectarManual = {
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  /** Informado quando o número já tinha sido registrado antes com outro PIN. */
  pinExistente?: string;
};

type NumeroInfo = { id?: string; display_phone_number?: string; verified_name?: string };

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // Só admin conecta um canal de atendimento do workspace inteiro — mesma regra do resto de
  // Configurações. `workspaceId` vem SEMPRE da sessão, nunca do corpo da requisição.
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode conectar o WhatsApp." }, { status: 403 });
  }
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as CorpoConectarManual;
  const accessToken = corpo.accessToken?.trim();
  const wabaId = corpo.wabaId?.trim();
  const phoneNumberId = corpo.phoneNumberId?.trim();

  if (!accessToken || !wabaId || !phoneNumberId) {
    return NextResponse.json(
      { erro: "Preencha o token de acesso, o ID da conta (WABA) e o ID do número." },
      { status: 400 },
    );
  }

  const existente = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
  });
  const metadadosAnteriores = (existente?.metadados as Record<string, unknown> | null) ?? {};

  // Valida o token ANTES de gravar qualquer coisa — um token errado (ou sem acesso a esse número)
  // falharia depois, no meio do fluxo, deixando a integração num estado pela metade. A mensagem da
  // Meta aqui é o que diz à pessoa o que exatamente está errado.
  let numero: NumeroInfo;
  try {
    numero = await chamarGraph<NumeroInfo>(
      `/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
      accessToken,
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Token inválido.";
    return NextResponse.json(
      {
        erro: `Não consegui usar esse token pra ler o número ${phoneNumberId}: ${mensagem}`,
        dica: "Confira se o token é de um usuário do sistema com acesso à conta do WhatsApp, e se o ID do número está certo.",
      },
      { status: 400 },
    );
  }

  if (numero.id && numero.id !== phoneNumberId) {
    return NextResponse.json({ erro: "O ID do número não confere com o que a Meta devolveu." }, { status: 400 });
  }

  try {
    const resultado = await finalizarConexaoWhatsapp({
      workspaceId,
      accessToken,
      wabaId,
      phoneNumberId,
      pinExistente: corpo.pinExistente?.trim() || undefined,
      metadadosAnteriores,
      metadadosExtras: { conexao: "manual" },
    });
    return NextResponse.json({ ...resultado, numeroExibicao: numero.display_phone_number });
  } catch (erro) {
    const passo = erro instanceof ErroConexao ? erro.passo : "metadados";
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar o WhatsApp Business.";
    await salvarFalhaConexao({
      workspaceId,
      mensagem,
      passo,
      wabaId,
      phoneNumberId,
      accessToken,
      metadadosAnteriores,
    }).catch(() => {});
    return NextResponse.json({ erro: mensagem, passo }, { status: 502 });
  }
}
