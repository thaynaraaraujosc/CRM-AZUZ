import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { nomeAindaEhIdCru } from "@/lib/conversas/exibicao";
import { renomearConversa } from "@/lib/conversas/renomear";
import { prisma } from "@/lib/prisma";

/**
 * DÁ NOME A UM NÚMERO QUE AINDA NÃO TEM.
 *
 * Quando o WhatsApp manda a primeira mensagem de alguém que não está na agenda, a conversa nasce
 * com o telefone no lugar do nome ("556294361377"). Quem atende descobre o nome na terceira linha
 * da conversa e não tinha onde escrevê-lo: o painel mostrava o número e pronto.
 *
 * O trabalho pesado já existia (`renomearConversa`): ele move mensagens, card do funil, contato e
 * a própria conversa na mesma transação, porque tudo isso é casado por NOME e não por chave
 * estrangeira. O que faltava era uma porta com sessão pra chamá-lo da tela.
 *
 * SÓ RENOMEIA O QUE AINDA É IDENTIFICADOR CRU. Esta rota não é um "renomear contato" genérico, e a
 * diferença importa: trocar o nome de alguém que já se chama "Marcos Aurélio" mexeria em
 * referências que a transação não alcança — condições de automação e filtros salvos escritos com
 * o nome antigo. Dar nome a um número não tem esse risco, porque ninguém escreve automação
 * apontando pra um telefone.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json().catch(() => null)) as { de?: unknown; para?: unknown } | null;
  const de = typeof corpo?.de === "string" ? corpo.de.trim() : "";
  const para = typeof corpo?.para === "string" ? corpo.para.trim().replace(/\s+/g, " ") : "";

  if (!de || !para) {
    return NextResponse.json({ erro: "Informe a conversa e o nome novo." }, { status: 400 });
  }
  if (!nomeAindaEhIdCru(de)) {
    return NextResponse.json(
      { erro: "Esta conversa já tem nome. Edite o contato em vez de renomeá-la." },
      { status: 400 },
    );
  }
  if (para.length < 2 || para.length > 80) {
    return NextResponse.json({ erro: "O nome precisa ter de 2 a 80 letras." }, { status: 400 });
  }
  if (nomeAindaEhIdCru(para)) {
    return NextResponse.json({ erro: "Esse nome é só números." }, { status: 400 });
  }

  /*
   * A CONVERSA PRECISA SER DESTE WORKSPACE.
   *
   * `renomearConversa` filtra tudo por `workspaceId`, então renomear a conversa de outra empresa
   * já era impossível — o `updateMany` simplesmente não acharia linha nenhuma. A checagem existe
   * pra dar a resposta certa em vez de um "pronto" silencioso sobre nada.
   */
  const existe = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: de } },
    select: { id: true },
  });
  if (!existe) {
    return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }

  /*
   * O TELEFONE NÃO SE PERDE AO GANHAR NOME.
   *
   * O número ERA o nome; trocando o nome, ele sumiria da tela se não fosse gravado no campo que
   * existe pra ele. Só preenche quando está vazio: se alguém já tinha digitado um WhatsApp ali,
   * o que a pessoa escreveu vale mais do que o identificador da conversa.
   */
  const contato = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: de } },
    select: { id: true, whatsapp: true },
  });

  /*
   * NOME JÁ USADO POR OUTRA PESSOA: recusa, em vez de estourar.
   *
   * `Contato.nome` é único dentro do workspace, então a transação de renomear quebraria sozinha —
   * com um erro de banco que vira "não deu certo" na tela, sem dizer o motivo. Juntar os dois
   * registros seria outra operação, bem maior (qual foto fica? qual etapa? e as etiquetas?), e
   * ninguém pediu por ela. Aqui a resposta diz o que houve e deixa a escolha com quem atende.
   */
  const nomeOcupado = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: para } },
    select: { id: true },
  });
  if (nomeOcupado && nomeOcupado.id !== contato?.id) {
    return NextResponse.json(
      { erro: `Já existe um contato chamado "${para}". Use outro nome.` },
      { status: 409 },
    );
  }

  await renomearConversa(workspaceId, de, para);

  if (contato && !contato.whatsapp) {
    await prisma.contato.update({ where: { id: contato.id }, data: { whatsapp: de } });
  }

  return NextResponse.json({ nome: para });
}
