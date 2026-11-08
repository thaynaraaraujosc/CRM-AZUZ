import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { auditar } from "@/lib/seguranca/auditoria";
import { lerNomeDoPerfil, lerTelefoneDoPerfil, iniciaisDe } from "@/lib/perfil/dados";
import { LIMITE_DA_FOTO } from "@/lib/imagens/preparar-foto";

/**
 * O PERFIL DE QUEM ESTÁ LOGADO — a rota que a pessoa usa sobre si mesma.
 *
 * Por que não reaproveitar `/api/equipe/[id]`: aquela rota é de ADMINISTRAÇÃO, exige
 * `exigirAdmin` e aceita mudar papel, permissões e `ativo`. Trocar a própria foto não pode
 * depender de ser dono da conta, e abrir aquela rota pra membro comum seria entregar junto o
 * caminho pra ele se promover a admin — que é exatamente o buraco que fecharam ali.
 *
 * Esta aqui exige só estar logado, não lê id nenhum do corpo (o alvo é sempre a sessão) e só
 * aceita três campos: nome, telefone e foto. Nada do que define PERMISSÃO passa por aqui.
 */

const CAMPOS = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  foto: true,
  initials: true,
  papel: true,
  criadoEm: true,
} as const;

export async function GET() {
  const guarda = await exigirSessao();
  if (!guarda.ok) return guarda.resposta;

  const membro = await prisma.membro.findUnique({
    where: { id: guarda.sessao.user.id },
    select: CAMPOS,
  });
  if (!membro) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 });

  return NextResponse.json({
    ...membro,
    criadoEm: membro.criadoEm.toISOString(),
    ehAdministrador: guarda.sessao.user.papelTipo === "admin" || Boolean(guarda.sessao.user.superAdmin),
  });
}

export async function PATCH(request: Request) {
  const guarda = await exigirSessao();
  if (!guarda.ok) return guarda.resposta;
  const membroId = guarda.sessao.user.id;

  const corpo = (await request.json().catch(() => null)) as
    | { nome?: unknown; telefone?: unknown; foto?: unknown }
    | null;
  if (!corpo) return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });

  const dados: Record<string, unknown> = {};

  if (corpo.nome !== undefined) {
    const lido = lerNomeDoPerfil(String(corpo.nome));
    if (!lido.ok) return NextResponse.json({ erro: lido.erro }, { status: 400 });
    dados.nome = lido.valor;
    // As iniciais são DERIVADAS do nome, e não um campo à parte: deixá-las pra trás faz o avatar
    // de quem trocou de nome continuar com as letras antigas pelo resto da vida da conta.
    dados.initials = iniciaisDe(lido.valor);
  }

  if (corpo.telefone !== undefined) {
    const lido = lerTelefoneDoPerfil(String(corpo.telefone));
    if (!lido.ok) return NextResponse.json({ erro: lido.erro }, { status: 400 });
    dados.telefone = lido.valor || null;
  }

  if (corpo.foto !== undefined) {
    if (corpo.foto === null || corpo.foto === "") {
      dados.foto = null;
    } else {
      const foto = String(corpo.foto);
      // O navegador já reduz a imagem antes de mandar (ver `preparar-foto.ts`). A conferência
      // aqui é porque o servidor não pode CONFIAR que foi o navegador do CRM que chamou.
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(foto)) {
        return NextResponse.json({ erro: "Formato de imagem não aceito." }, { status: 400 });
      }
      if (foto.length > LIMITE_DA_FOTO) {
        return NextResponse.json({ erro: "Essa imagem é grande demais." }, { status: 400 });
      }
      dados.foto = foto;
    }
  }

  if (!Object.keys(dados).length) {
    return NextResponse.json({ erro: "Nada pra atualizar." }, { status: 400 });
  }

  const membro = await prisma.membro.update({
    where: { id: membroId },
    data: dados,
    select: CAMPOS,
  });

  // Sem o valor dos campos no registro: telefone é dado pessoal, e auditoria não é lugar de
  // guardar o que já está na linha do membro.
  await auditar({
    acao: "perfil.editado",
    workspaceId: guarda.workspaceId,
    membroId,
    recurso: Object.keys(dados).join(","),
  });

  return NextResponse.json({ ...membro, criadoEm: membro.criadoEm.toISOString() });
}
