import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { slugId } from "@/lib/ids";
import { PLANOS } from "@/lib/assinatura/planos";
import { VALIDADE_CONVITE_MS, gerarTokenConvite, hashDoToken } from "@/lib/equipe/convite";
import { auditar } from "@/lib/seguranca/auditoria";
import { enviarEmailContandoFalha, templateConvite } from "@/lib/email";

/** GET lista todos os workspaces da plataforma (cross-tenant, só o super-admin chega aqui) com o
 * essencial pra tabela: quantos membros, plano/status da assinatura, quando foi criado. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const workspaces = await prisma.workspace.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      _count: { select: { membros: true } },
      assinatura: { select: { plano: true, status: true, valor: true, proximoVencimento: true } },
    },
  });

  return NextResponse.json(workspaces);
}

/**
 * Cria uma conta de CORTESIA: empresa nova, com a pessoa já como administradora dela e a
 * assinatura já ativa.
 *
 * Existe porque o caminho normal tem um degrau que não faz sentido aqui. Quem se cadastra por
 * `/cadastro` nasce com assinatura "pendente" e cai direto na tela de bloqueio; liberar depois,
 * pelo detalhe do workspace, é um segundo passo que só o super-admin consegue dar e que deixa a
 * pessoa parada até alguém lembrar. Para conta de teste, de sócio ou de demonstração, o certo é
 * nascer liberada.
 *
 * O que ela NÃO faz: cobrança. Nenhuma assinatura é criada na Asaas e `asaasCustomerId` fica
 * vazio, então não existe fatura, boleto nem cartão. Encerrar depois é mudar o status pra
 * "cancelada" no detalhe do workspace.
 *
 * A senha não é definida aqui, de propósito: sai um link de convite com token, e quem cria a senha
 * é a própria pessoa. É a mesma regra do convite de equipe, e ela existe pra que ninguém, nem o
 * super-admin, precise escolher (ou ver) a senha de outra pessoa.
 */
export async function POST(request: Request) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const corpo = (await request.json()) as { empresa?: string; nome?: string; email?: string };
  const empresa = corpo.empresa?.trim();
  const nome = corpo.nome?.trim();
  const email = corpo.email?.trim().toLowerCase();

  if (!empresa || !nome || !email) {
    return NextResponse.json({ erro: "Campos obrigatórios: empresa, nome e e-mail." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  const emailExistente = await prisma.membro.findUnique({ where: { email }, select: { id: true } });
  if (emailExistente) {
    return NextResponse.json({ erro: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  // Mesma geração de identificador do cadastro público: slug com sufixo até não colidir.
  const slugBase = slugId(empresa) || "empresa";
  let slug = slugBase;
  let sufixo = 1;
  while (await prisma.workspace.findUnique({ where: { slug }, select: { slug: true } })) {
    sufixo += 1;
    slug = `${slugBase}-${sufixo}`;
  }

  const idBase = slugId(nome) || "membro";
  let membroId = idBase;
  sufixo = 1;
  while (await prisma.membro.findUnique({ where: { id: membroId }, select: { id: true } })) {
    sufixo += 1;
    membroId = `${idBase}-${sufixo}`;
  }

  const initials = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // O token existe em texto puro só aqui e no link. O banco guarda o hash.
  const token = gerarTokenConvite();

  await prisma.$transaction(async (tx) => {
    await tx.workspace.create({ data: { id: slug, nome: empresa, slug } });

    await tx.membro.create({
      data: {
        id: membroId,
        workspaceId: slug,
        initials,
        nome,
        email,
        senha: null,
        papel: "Administrador",
        papelTipo: "admin",
        leads: "-",
        enxerga: "Tudo",
        permissoes: [],
        ativo: false,
        convitePendente: true,
        conviteTokenHash: hashDoToken(token),
        conviteExpiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
      },
    });

    // "ativa" desde o primeiro segundo: é o que diferencia esta rota do cadastro público e o
    // motivo dela existir. `asaasCustomerId` vazio deixa registrado que não há cobrança por trás.
    await tx.assinatura.create({
      data: {
        id: `assinatura-${slug}`,
        workspaceId: slug,
        plano: "completo",
        valor: PLANOS.completo.valor,
        status: "ativa",
        asaasCustomerId: "",
      },
    });
  });

  await auditar({
    acao: "workspace.alterado",
    workspaceId: slug,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: slug,
    detalhe: `conta de cortesia criada para ${email}`,
  });

  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${membroId}?t=${token}`;
  const envio = await enviarEmailContandoFalha({
    to: email,
    subject: "Seu acesso ao CRM AZUZ",
    html: templateConvite(nome, empresa, link),
  });

  return NextResponse.json(
    {
      workspaceId: slug,
      membroId,
      linkConvite: link,
      emailEnviado: envio.ok,
      motivoEmail: envio.ok ? undefined : envio.motivo,
    },
    { status: 201 },
  );
}
