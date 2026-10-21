import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerDadosDaEmpresa, lerNomeDoEspaco, type DadosDaEmpresa } from "@/lib/empresa/dados";
import { LIMITE_DA_LOGO } from "@/lib/imagens/tamanho-da-logo";

/**
 * GET devolve as colunas reais do `Workspace`. Fonte única de verdade pra Configurações › Dados da
 * empresa, em vez do blob genérico de preferências (que só guarda o resto dos campos descritivos:
 * país, cidade, fuso, idioma, moeda, formatos). Sem isso, o formulário carregava o nome/segmento do
 * blob (que podia nascer vazio ou dessincronizar da coluna real usada na sessão/sidebar/e-mails),
 * dando a impressão de que editar "não salvava".
 *
 * A LOGO E O NOME VÃO PRA TODO MUNDO; o resto, só pra quem administra. A logo aparece no topo do
 * menu de cada pessoa da equipe, então ela precisa ser legível por todas elas. Já o CNPJ, o e-mail
 * e o endereço da empresa são dado administrativo: quem não administra não tem o que fazer com
 * eles, e uma tela que mostra o que a pessoa não pode mudar só ensina a ignorar o que está escrito.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: sessao.user.workspaceId },
    select: {
      nome: true,
      segmento: true,
      logo: true,
      empresaNome: true,
      empresaFantasia: true,
      empresaDocumento: true,
      empresaEmail: true,
      empresaTelefone: true,
      empresaSite: true,
      empresaEndereco: true,
    },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  const ehAdministrador = sessao.user.papelTipo === "admin" || Boolean(sessao.user.superAdmin);

  return NextResponse.json(
    {
      nome: workspace.nome,
      segmento: workspace.segmento ?? "",
      logo: workspace.logo ?? null,
      ehAdministrador,
      ...(ehAdministrador
        ? {
            empresaNome: workspace.empresaNome ?? "",
            empresaFantasia: workspace.empresaFantasia ?? "",
            empresaDocumento: workspace.empresaDocumento ?? "",
            empresaEmail: workspace.empresaEmail ?? "",
            empresaTelefone: workspace.empresaTelefone ?? "",
            empresaSite: workspace.empresaSite ?? "",
            empresaEndereco: workspace.empresaEndereco ?? "",
          }
        : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * PATCH atualiza colunas reais do `Workspace`. `nome` precisa ser coluna de verdade porque é lido
 * em vários lugares fora desse formulário (sidebar via sessão, e-mail de convite, PDF de relatório,
 * painel de super-admin); `segmento` virou coluna pelo mesmo motivo, e os dados da empresa nascem
 * assim pela mesma razão.
 *
 * AS MESMAS REGRAS DA TELA, conferidas de novo aqui (`lib/empresa/dados.ts`). Não é desconfiança da
 * tela: é que um PATCH não precisa vir dela. Sem esta conferência, um CNPJ inventado entraria pela
 * API e sairia numa nota fiscal.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só o admin do workspace pode editar essas informações." }, { status: 403 });
  }

  const corpo = (await request.json().catch(() => ({}))) as Partial<DadosDaEmpresa> & {
    nome?: string;
    segmento?: string;
    logo?: string | null;
  };

  const dados: Record<string, string | null> = {};

  if (corpo.nome !== undefined) {
    const lido = lerNomeDoEspaco(corpo.nome);
    if (!lido.ok) return NextResponse.json({ erro: lido.erro }, { status: 400 });
    dados.nome = lido.valor;
  }

  if (corpo.segmento !== undefined) {
    dados.segmento = corpo.segmento.trim() || null;
  }

  /*
   * A LOGO VEM SOZINHA, no pedido dela.
   *
   * Ela é gravada no instante em que o arquivo é escolhido, enquanto os campos de texto esperam o
   * botão Salvar. Misturar as duas coisas num pedido só faria a troca da logo arrastar junto um
   * formulário que a pessoa ainda estava preenchendo — e, se algum campo não passasse na
   * conferência, a logo escolhida não entraria por causa de um CNPJ pela metade.
   */
  if (corpo.logo !== undefined) {
    if (corpo.logo === null) {
      dados.logo = null;
    } else if (typeof corpo.logo !== "string" || !corpo.logo.startsWith("data:image/")) {
      return NextResponse.json({ erro: "A logo precisa ser uma imagem." }, { status: 400 });
    } else if (corpo.logo.length > LIMITE_DA_LOGO) {
      // A tela reduz a imagem antes de mandar, então isto só acontece fora dela. Sem o teto, a
      // coluna aceitaria um arquivo que viajaria em toda leitura do workspace, em toda página.
      return NextResponse.json({ erro: "Essa imagem é grande demais. Reduza antes de enviar." }, { status: 400 });
    } else {
      dados.logo = corpo.logo;
    }
  }

  // Os campos da empresa só são tocados quando ALGUM deles veio: um PATCH que manda só a logo não
  // pode apagar o CNPJ por omissão.
  const camposDaEmpresa = [
    "empresaNome",
    "empresaFantasia",
    "empresaDocumento",
    "empresaEmail",
    "empresaTelefone",
    "empresaSite",
    "empresaEndereco",
  ] as const;
  if (camposDaEmpresa.some((campo) => corpo[campo] !== undefined)) {
    const lido = lerDadosDaEmpresa(corpo);
    if (!lido.ok) return NextResponse.json({ erro: lido.erro }, { status: 400 });
    for (const campo of camposDaEmpresa) {
      // Vazio vira `null` na coluna: "" e `null` significam a mesma coisa pra quem lê, e guardar os
      // dois deixaria a consulta ter que testar as duas formas pra sempre.
      dados[campo] = lido.dados[campo] || null;
    }
  }

  if (!Object.keys(dados).length) {
    return NextResponse.json({ erro: "Nada pra salvar." }, { status: 400 });
  }

  await prisma.workspace.update({ where: { id: sessao.user.workspaceId }, data: dados });

  return NextResponse.json({ ok: true });
}
