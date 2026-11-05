import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { esquecerStatus } from "@/lib/assinatura/status-cache";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import bcrypt from "bcryptjs";

import { slugId } from "@/lib/ids";
import { diasDeCortesia, fimDaCortesia, statusEfetivo } from "@/lib/assinatura/cortesia";
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
      assinatura: {
        select: {
          plano: true,
          status: true,
          valor: true,
          proximoVencimento: true,
          cortesiaAte: true,
          asaasSubscriptionId: true,
        },
      },
    },
  });

  /*
   * O STATUS QUE A TELA MOSTRA é o EFETIVO, não a coluna crua.
   *
   * Uma cortesia vencida continua com "ativa" gravado — foi ela que deixou assim —, e a lista
   * dizendo "Ativo" pra uma conta que já caiu na tela de pagamento é a diferença entre o painel
   * explicar a realidade e inventar outra.
   */
  return NextResponse.json(
    workspaces.map((w) => ({
      ...w,
      assinatura: w.assinatura
        ? {
            ...w.assinatura,
            status: statusEfetivo(w.assinatura),
            statusGravado: w.assinatura.status,
            // Cortesia é o que não entra no MRR: a conta usa o produto e não paga nada.
            ehCortesia: Boolean(w.assinatura.cortesiaAte) || !w.assinatura.asaasSubscriptionId?.trim(),
            diasDeCortesia: diasDeCortesia(w.assinatura),
          }
        : null,
    })),
  );
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

  const corpo = (await request.json()) as {
    empresa?: string;
    nome?: string;
    email?: string;
    senha?: string;
    /** Quantos meses de cortesia. 0 = sem prazo (a conta já nasce cobrável). */
    meses?: number;
  };
  const empresa = corpo.empresa?.trim();
  const nome = corpo.nome?.trim();
  const email = corpo.email?.trim().toLowerCase();
  const senha = corpo.senha?.trim();
  const meses = Number(corpo.meses ?? 0);

  if (!empresa || !nome || !email) {
    return NextResponse.json({ erro: "Campos obrigatórios: empresa, nome e e-mail." }, { status: 400 });
  }
  if (senha && senha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (!Number.isFinite(meses) || meses < 0 || meses > 36) {
    return NextResponse.json({ erro: "Prazo de cortesia inválido." }, { status: 400 });
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
  /*
   * A SENHA É OPCIONAL, e o convite continua sendo o caminho normal.
   *
   * Quem cria a senha deveria ser a própria pessoa: ninguém, nem o super-admin, precisa escolher
   * ou ver a senha de outro. Mas há o caso em que a conta é entregue na mão — numa reunião, numa
   * demonstração, pra alguém que não vai procurar e-mail nenhum — e aí o convite é um degrau que
   * faz a entrega falhar. Com senha, a conta nasce pronta pra entrar; sem senha, sai o link.
   */
  const comSenha = Boolean(senha);
  const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
  const cortesiaAte = meses > 0 ? fimDaCortesia(meses) : null;

  await prisma.$transaction(async (tx) => {
    await tx.workspace.create({ data: { id: slug, nome: empresa, slug } });

    await tx.membro.create({
      data: {
        id: membroId,
        workspaceId: slug,
        initials,
        nome,
        email,
        senha: senhaHash,
        papel: "Administrador",
        papelTipo: "admin",
        leads: "-",
        enxerga: "Tudo",
        permissoes: [],
        // Com senha a conta já entra; sem senha ela espera o convite ser aceito.
        ativo: comSenha,
        convitePendente: !comSenha,
        conviteTokenHash: comSenha ? null : hashDoToken(token),
        conviteExpiraEm: comSenha ? null : new Date(Date.now() + VALIDADE_CONVITE_MS),
      },
    });

    /*
     * "ativa" desde o primeiro segundo: é o que diferencia esta rota do cadastro público e o
     * motivo dela existir. `asaasCustomerId` vazio deixa registrado que não há cobrança por trás.
     *
     * `cortesiaAte` é o prazo. Com ele, a conta usa o CRM inteiro sem cobrança até o dia marcado
     * e cai na tela de pagamento a partir dele — sem ninguém precisar lembrar de voltar aqui. Sem
     * prazo escolhido, a cortesia é por tempo indeterminado, como era antes.
     */
    await tx.assinatura.create({
      data: {
        id: `assinatura-${slug}`,
        workspaceId: slug,
        plano: "completo",
        valor: PLANOS.completo.valor,
        status: "ativa",
        asaasCustomerId: "",
        cortesiaAte,
        // A primeira cobrança parte do fim da cortesia: é o que a tela de pagamento mostra.
        proximoVencimento: cortesiaAte,
      },
    });
  });
  // Nasce ativa: o cache do paywall precisa saber disso já na primeira requisição dela.
  esquecerStatus(slug);

  await auditar({
    acao: "workspace.alterado",
    workspaceId: slug,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: slug,
    detalhe: `conta de cortesia criada para ${email}${cortesiaAte ? ` até ${cortesiaAte.toISOString().slice(0, 10)}` : " sem prazo"}`,
  });

  // Com senha definida não há convite pra mandar: a conta já entra, e um e-mail pedindo pra criar
  // senha confundiria quem acabou de receber a senha na mão.
  const link = comSenha ? null : `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${membroId}?t=${token}`;
  const envio = link
    ? await enviarEmailContandoFalha({
        to: email,
        subject: "Seu acesso ao CRM AZUZ",
        html: templateConvite(nome, empresa, link),
      })
    : { ok: true as const, motivo: undefined };

  return NextResponse.json(
    {
      workspaceId: slug,
      membroId,
      linkConvite: link,
      comSenha,
      cortesiaAte: cortesiaAte?.toISOString() ?? null,
      emailEnviado: envio.ok,
      motivoEmail: envio.ok ? undefined : envio.motivo,
    },
    { status: 201 },
  );
}
