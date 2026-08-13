import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { PLANOS } from "@/lib/assinatura/planos";

/**
 * POST cria uma empresa nova (Workspace) + o primeiro Membro (admin) numa transação — fluxo de
 * autocadastro em /cadastro. Slug do Workspace e id do Membro derivam do nome (mesmo padrão de
 * slugId já usado em Contato/Membro), com sufixo numérico se já existir.
 */
export async function POST(request: Request) {
  const dados = (await request.json()) as {
    empresa?: string;
    nome?: string;
    email?: string;
    senha?: string;
  };

  if (!dados.empresa || !dados.nome || !dados.email || !dados.senha) {
    return NextResponse.json(
      { erro: "Campos obrigatórios: empresa, nome, email, senha" },
      { status: 400 }
    );
  }

  if (dados.senha.length < 8) {
    return NextResponse.json(
      { erro: "A senha precisa ter pelo menos 8 caracteres" },
      { status: 400 }
    );
  }

  const emailExistente = await prisma.membro.findUnique({ where: { email: dados.email } });
  if (emailExistente) {
    return NextResponse.json({ erro: "Já existe uma conta com esse e-mail" }, { status: 409 });
  }

  const slugBase = slugId(dados.empresa);
  let slug = slugBase;
  let sufixo = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    sufixo += 1;
    slug = `${slugBase}-${sufixo}`;
  }

  const idBase = slugId(dados.nome);
  let membroId = idBase;
  sufixo = 1;
  while (await prisma.membro.findUnique({ where: { id: membroId } })) {
    sufixo += 1;
    membroId = `${idBase}-${sufixo}`;
  }

  const initials = dados.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { id: slug, nome: dados.empresa!, slug },
    });

    await tx.membro.create({
      data: {
        id: membroId,
        workspaceId: workspace.id,
        initials,
        nome: dados.nome!,
        email: dados.email!,
        senha: senhaHash,
        papel: "Administrador",
        papelTipo: "admin",
        leads: "—",
        enxerga: "Tudo",
        permissoes: [],
        ativo: true,
        convitePendente: false,
      },
    });

    // Assinatura nasce "pendente" — sem isso o proxy (bloqueio por pagamento, ver `proxy.ts`)
    // trataria um workspace novo como "sem assinatura" e liberaria acesso total até alguém pagar,
    // que é exatamente o buraco que fechamos: nenhum workspace fica sem essa linha.
    await tx.assinatura.create({
      data: {
        id: `assinatura-${workspace.id}`,
        workspaceId: workspace.id,
        plano: "completo",
        valor: PLANOS.completo.valor,
        status: "pendente",
        asaasCustomerId: "",
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
