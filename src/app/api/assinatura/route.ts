import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANOS, ehPlanoValido } from "@/lib/assinatura/planos";
import {
  cancelarAssinatura,
  criarAssinatura,
  criarOuBuscarCliente,
  listarCobrancas,
  type FormaPagamentoAsaas,
} from "@/lib/integracoes/asaas";

/** GET devolve a assinatura atual do workspace (o que está salvo localmente, não chama a Asaas de
 * novo pra isso) mais o histórico de cobranças, buscado ao vivo na Asaas — ver comentário no
 * schema (`model Assinatura`) sobre por que o histórico não é espelhado no banco. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const assinatura = await prisma.assinatura.findUnique({ where: { workspaceId: sessao.user.workspaceId } });
  if (!assinatura) return NextResponse.json({ assinatura: null, cobrancas: [] });

  try {
    const cobrancas = assinatura.asaasSubscriptionId ? await listarCobrancas(assinatura.asaasSubscriptionId) : [];
    return NextResponse.json({ assinatura, cobrancas });
  } catch {
    // Asaas fora do ar não pode derrubar a tela de Configurações — mostra a assinatura salva sem
    // histórico em vez de erro 500.
    return NextResponse.json({ assinatura, cobrancas: [] });
  }
}

type CorpoCriarAssinatura = {
  plano: string;
  formaPagamento: FormaPagamentoAsaas;
  cpfCnpj: string;
  cartao?: {
    numero: string;
    nomeImpresso: string;
    validadeMes: string;
    validadeAno: string;
    cvv: string;
    titular: { cep: string; numeroEndereco: string; telefone: string };
  };
};

/** POST assina (ou troca de plano — cancela a assinatura anterior na Asaas e cria outra, a Asaas
 * não tem "trocar valor de assinatura ativa" de forma simples via API pública) o workspace de quem
 * está logado. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só administradores podem alterar o plano." }, { status: 403 });
  }

  const corpo = (await request.json()) as CorpoCriarAssinatura;
  if (!ehPlanoValido(corpo.plano)) {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }
  if (corpo.formaPagamento === "CREDIT_CARD" && !corpo.cartao) {
    return NextResponse.json({ erro: "Dados do cartão são obrigatórios." }, { status: 400 });
  }
  if (!corpo.cpfCnpj) {
    return NextResponse.json({ erro: "CPF/CNPJ é obrigatório." }, { status: 400 });
  }

  const workspaceId = sessao.user.workspaceId;
  const plano = PLANOS[corpo.plano];

  // Se já existe uma assinatura salva pra esse workspace, cancela a antiga na Asaas antes de criar
  // outra — sem isso, cada troca de plano (ou cada retry depois de um erro) deixa uma assinatura
  // órfã cobrando em paralelo na Asaas, sem ligação nenhuma com o que fica salvo aqui.
  const assinaturaExistente = await prisma.assinatura.findUnique({ where: { workspaceId } });
  if (assinaturaExistente?.asaasSubscriptionId && assinaturaExistente.status !== "cancelada") {
    try {
      await cancelarAssinatura(assinaturaExistente.asaasSubscriptionId);
    } catch {
      // Segue mesmo se a assinatura antiga já não existir mais (ex.: cancelada manualmente na
      // Asaas) — não pode travar quem só quer assinar de novo.
    }
  }

  try {
    const cliente = await criarOuBuscarCliente({
      workspaceId,
      nome: sessao.user.workspaceNome,
      email: sessao.user.email ?? "",
      cpfCnpj: corpo.cpfCnpj,
    });

    const assinaturaAsaas = await criarAssinatura({
      customerId: cliente.id,
      valor: plano.valor,
      formaPagamento: corpo.formaPagamento,
      descricao: `CRM Azuz — plano ${plano.nome}`,
      cartao: corpo.cartao
        ? {
            numero: corpo.cartao.numero,
            nomeImpresso: corpo.cartao.nomeImpresso,
            validadeMes: corpo.cartao.validadeMes,
            validadeAno: corpo.cartao.validadeAno,
            cvv: corpo.cartao.cvv,
            titular: {
              nome: sessao.user.workspaceNome,
              email: sessao.user.email ?? "",
              cpfCnpj: corpo.cpfCnpj,
              cep: corpo.cartao.titular.cep,
              numeroEndereco: corpo.cartao.titular.numeroEndereco,
              telefone: corpo.cartao.titular.telefone,
            },
          }
        : undefined,
    });

    let assinatura;
    try {
      assinatura = await prisma.assinatura.upsert({
        where: { workspaceId },
        create: {
          id: `assinatura-${workspaceId}`,
          workspaceId,
          plano: corpo.plano,
          valor: plano.valor,
          status: assinaturaAsaas.status === "ACTIVE" ? "ativa" : "pendente",
          asaasCustomerId: cliente.id,
          asaasSubscriptionId: assinaturaAsaas.id,
          formaPagamento: corpo.formaPagamento,
          proximoVencimento: new Date(assinaturaAsaas.nextDueDate),
        },
        update: {
          plano: corpo.plano,
          valor: plano.valor,
          status: assinaturaAsaas.status === "ACTIVE" ? "ativa" : "pendente",
          asaasCustomerId: cliente.id,
          asaasSubscriptionId: assinaturaAsaas.id,
          formaPagamento: corpo.formaPagamento,
          proximoVencimento: new Date(assinaturaAsaas.nextDueDate),
          canceladaEm: null,
        },
      });
    } catch (erroSalvar) {
      // A assinatura já foi criada de verdade na Asaas nesse ponto — se não conseguir salvar
      // localmente (ex.: banco fora do ar), cancela ela na Asaas também, pra não deixar cobrança
      // órfã que ninguém vê nesta tela.
      await cancelarAssinatura(assinaturaAsaas.id).catch(() => {});
      throw erroSalvar;
    }

    return NextResponse.json({ assinatura });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao criar assinatura na Asaas.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
