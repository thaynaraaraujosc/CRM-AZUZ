import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis } from "@/lib/integracoes/conta-canal";
import { adotarMensagensOrfas } from "@/lib/conversas/adotar-orfas";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { conferirCanalQrCode } from "@/lib/integracoes/saude-qrcode";

/**
 * Por que uma mensagem está no banco e não aparece na tela.
 *
 * Uma conversa só mostra as mensagens da CONEXÃO ativa (ver `conta-canal.ts`). Quando o
 * identificador gravado na mensagem diverge por um fio do que está nos metadados da integração, a
 * mensagem é gravada e nunca aparece. E o sintoma ("conversa na lista, vazia por dentro", ou
 * "some ao atualizar a página") não aponta pra causa. Já aconteceu duas vezes com o Instagram.
 *
 * Esta rota põe os dois lados lado a lado: o que as mensagens dizem e o que as conexões dizem.
 * Nenhum dado sensível sai daqui. Só identificadores de número e contagens.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const [porContaCanal, visiveis, integracoes, conversasPorConta, todasAsConversas, cards] =
    await Promise.all([
      prisma.mensagemExtra.groupBy({
        by: ["contaCanal", "canal"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      contasCanalVisiveis(workspaceId),
      prisma.integracao.findMany({
        where: { workspaceId, provedor: { in: ["whatsapp_nao_oficial", "meta_whatsapp", "meta_instagram"] } },
        select: { provedor: true, status: true, metadados: true },
      }),
      // A caixa de entrada lista CONVERSAS, não mensagens. Contar só mensagem responde a pergunta
      // errada: dá pra ter toda mensagem visível e mesmo assim nenhuma conversa na tela.
      prisma.conversa.groupBy({
        by: ["contaCanal", "canal"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      prisma.conversa.findMany({
        where: { workspaceId },
        select: { nome: true, canal: true, ehGrupo: true },
      }),
      prisma.negocioCard.findMany({ where: { workspaceId }, select: { nome: true, contaCanal: true } }),
    ]);

  const mensagens = porContaCanal.map((linha) => ({
    contaCanal: linha.contaCanal,
    canal: linha.canal,
    quantidade: linha._count._all,
    // O veredito: esta linha aparece na tela hoje, ou está invisível?
    apareceNaTela:
      visiveis.contas.includes(linha.contaCanal) ||
      visiveis.prefixosSemIdentificador.some((p) => linha.contaCanal?.startsWith(`${p}:`)),
  }));

  /*
   * A janela de 24 horas, do jeito que o CRM enxerga.
   *
   * A Meta recusa texto livre fora dela, e o CRM confere antes de tentar usando a última mensagem
   * RECEBIDA que ele tem gravada. Quando os dois discordam (o CRM deixa passar e a Meta recusa), a
   * causa está aqui: ou falta no CRM a mensagem que fecharia a conta, ou ela está gravada com
   * outro nome de contato. Sem este quadro, esse desacordo é invisível.
   */
  const ultimasRecebidas = await prisma.mensagemExtra.groupBy({
    by: ["contato"],
    where: { workspaceId, tipo: "in" },
    _max: { criadoEm: true },
  });
  const recebidaPorContato = new Map(ultimasRecebidas.map((m) => [m.contato, m._max.criadoEm]));
  const JANELA_MS = 24 * 60 * 60 * 1000;
  const janela = todasAsConversas
    .filter((c) => !c.ehGrupo && c.canal !== "Instagram")
    .map((c) => {
      const ultima = recebidaPorContato.get(c.nome) ?? null;
      return {
        nome: c.nome,
        ultimaRecebida: ultima?.toISOString() ?? null,
        horasDesdeAUltima: ultima ? Math.round(((Date.now() - ultima.getTime()) / 3_600_000) * 10) / 10 : null,
        crmAchaQueEstaAberta: Boolean(ultima && Date.now() - ultima.getTime() < JANELA_MS),
      };
    })
    .sort((a, b) => (a.horasDesdeAUltima ?? 1e9) - (b.horasDesdeAUltima ?? 1e9));

  const visivel = (contaCanal: string | null) =>
    visiveis.contas.includes(contaCanal) ||
    visiveis.prefixosSemIdentificador.some((p) => contaCanal?.startsWith(`${p}:`));

  const conversas = conversasPorConta.map((linha) => ({
    contaCanal: linha.contaCanal,
    canal: linha.canal,
    quantidade: linha._count._all,
    apareceNaTela: visivel(linha.contaCanal),
  }));

  /*
   * Negócio no funil sem conversa nenhuma no CRM.
   *
   * É a pergunta que o diagnóstico não respondia: "chegou no funil e não chegou no WhatsApp" tem
   * duas causas possíveis e opostas. Ou a conversa existe e está escondida por filtro, ou ela nunca
   * foi criada. As duas se parecem na tela e se consertam em lugares diferentes.
   */
  const nomesComConversa = new Set(todasAsConversas.map((c) => c.nome));
  const chavesComConversa = new Map(todasAsConversas.map((c) => [chaveDeContato(c.nome), c.nome]));
  const negociosSemConversa = cards
    .filter((c) => !nomesComConversa.has(c.nome))
    .map((c) => ({
      nome: c.nome,
      contaCanal: c.contaCanal,
      // A conversa existe com o nome escrito de outro jeito? É a diferença entre "a mensagem não
      // chegou" e "chegou e o CRM não reconheceu que é a mesma pessoa".
      conversaComOutroNome: chavesComConversa.get(chaveDeContato(c.nome)) ?? null,
    }));

  // O elo que não fica neste banco: o aviso de mensagem nova registrado do lado da Evolution.
  // Quando ele se perde, o WhatsApp segue perfeito no celular e nada chega aqui. Confere e repara.
  const canalQrCode = await conferirCanalQrCode(workspaceId, { reparar: true }).catch(() => null);

  return NextResponse.json(
    {
      canalQrCode,
      resumo: {
        conversasNoBanco: todasAsConversas.length,
        conversasQueAparecem: conversas.filter((c) => c.apareceNaTela).reduce((s, c) => s + c.quantidade, 0),
        negociosNoFunil: cards.length,
        negociosSemConversa: negociosSemConversa.length,
      },
      conversas,
      janela,
      negociosSemConversa,
      conexoes: integracoes.map((i) => {
        const m = (i.metadados as Record<string, unknown> | null) ?? {};
        return {
          provedor: i.provedor,
          status: i.status,
          phoneNumberId: (m.phoneNumberId as string) ?? null,
          wabaId: (m.wabaId as string) ?? null,
          numero: (m.numero as string) ?? (m.displayPhoneNumber as string) ?? null,
          instagramContaId: (m.instagramContaId as string) ?? null,
        };
      }),
      contasVisiveis: visiveis.contas,
      provedoresSemIdentificador: visiveis.prefixosSemIdentificador,
      mensagens,
      invisiveis: mensagens.filter((m) => !m.apareceNaTela),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Reparo manual, pra suporte. O reparo de verdade roda sozinho pelo relógio (ver
 * `adotarOrfasDeTodosOsWorkspaces`, chamado pelo cron): não há botão pra isso no produto, porque
 * ninguém que compra um CRM deve precisar apertar um botão pra ver as próprias mensagens.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { adotadas, aindaOrfas, fotosCopiadas } = await adotarMensagensOrfas(sessao.user.workspaceId);

  return NextResponse.json(
    {
      adotadas,
      aindaOrfas,
      fotosCopiadas,
      observacao:
        "As que sobraram pertencem a conversas sem conexão dona. Histórico antigo do WhatsApp por QR Code. " +
        "Elas voltam sozinhas quando aquela conexão for reconectada.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
