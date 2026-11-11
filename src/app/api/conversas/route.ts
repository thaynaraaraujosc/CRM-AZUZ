import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import { nomeLivreParaConversa } from "@/lib/conversas/nome-por-numero";
import { ESCOPOS, escopoPermitido } from "@/lib/configuracoes/permissoes";
import { grafiasDoContaCanal } from "@/lib/integracoes/conta-canal-normalizar";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";
import { contasCanalVisiveis, filtroContaCanal, provedoresConectados } from "@/lib/integracoes/conta-canal";
import { cabecalhosComEtag, clienteJaTem, montarEtag, naoModificado } from "@/lib/conversas/assinatura";

/**
 * GET lista as conversas do workspace de quem está logado, mais recentes primeiro: só as da(s)
 * conexão(ões) de WhatsApp conectada(s) agora (ver `conta-canal.ts`). Nada é apagado ao
 * desconectar: a conversa continua no banco e reaparece inteira se aquele número voltar.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const visiveis = await contasCanalVisiveis(sessao.user.workspaceId);
  const provedores = await provedoresConectados(sessao.user.workspaceId);
  const filtro = filtroContaCanal(visiveis);

  // Conversa do Instagram aparece enquanto o Instagram estiver conectado, tenha ela conexão
  // marcada ou não. Sem isto, uma conversa criada antes dessa coluna existir (ou sem o
  // identificador gravado) caía na regra do WhatsApp e só apareceria com o QR Code conectado.
  // Ficava invisível em Conversas enquanto o negócio dela continuava no funil. Ver o card órfão
  // que apareceu na tela: o mesmo contato existindo num lugar e não no outro.
  // Conversa do Direct anterior a esta coluna existir (`contaCanal` nulo) continua aparecendo
  // enquanto o Instagram estiver conectado: ela nasceu quando havia UMA conexão só, então não
  // mistura conta nenhuma. O que saiu daqui foi o `{ canal: "Instagram" }` solto, que mostrava
  // também as conversas de OUTRA conta do Instagram e fazia duas contas conviverem na mesma lista.
  const where = provedores.includes("meta_instagram")
    ? {
        workspaceId: sessao.user.workspaceId,
        OR: [...(filtro.OR ?? [{ contaCanal: filtro.contaCanal }]), { canal: "Instagram", contaCanal: null }],
      }
    : { workspaceId: sessao.user.workspaceId, ...filtro };

  // Igual à rota de mensagens: a pergunta barata antes da cara. Esta tela também é batida a cada
  // 5 segundos, e responder `304` aqui evita ler a lista inteira de conversas por nada.
  // O contato entra na assinatura porque a foto dele é usada como reserva mais abaixo. Ela pode
  // mudar sem que a conversa mude, e a tela ficaria com as iniciais até alguém recarregar.
  const [resumoConversas, resumoContatos] = await Promise.all([
    prisma.conversa.aggregate({ where, _count: { _all: true }, _max: { atualizadoEm: true } }),
    prisma.contato.aggregate({
      where: { workspaceId: sessao.user.workspaceId },
      _count: { _all: true },
      _max: { atualizadoEm: true },
    }),
  ]);
  const etag = montarEtag([
    sessao.user.workspaceId,
    // O RECORTE ENTRA NA ASSINATURA: duas pessoas da mesma empresa com recortes diferentes veem
    // listas diferentes, e uma assinatura igual pras duas é um `304` devolvendo a lista da outra.
    (escopoPermitido(sessao.user.permissoes, ESCOPOS.numerosDeWhatsApp) ?? ["todos"]).join(","),
    [...visiveis.contas, ...visiveis.prefixosSemIdentificador].join(","),
    provedores.join(","),
    resumoConversas._count._all,
    resumoConversas._max.atualizadoEm,
    resumoContatos._count._all,
    resumoContatos._max.atualizadoEm,
  ]);
  if (clienteJaTem(request, etag)) return naoModificado(etag);

  /*
   * O RECORTE DE NÚMEROS DESTA PESSOA, aplicado no servidor.
   *
   * "Quais dos WhatsApp ele pode ver? Porque às vezes eu quero colocar um número aqui dentro do
   * meu CRM e quero que esse funcionário veja apenas o funil dele."
   *
   * Aqui e não na tela: esconder no navegador é esconder de quem olha, não de quem pede — a lista
   * inteira chegaria a quem abrisse as ferramentas do navegador, com nome e telefone de cliente.
   *
   * As DUAS GRAFIAS do canal de QR Code entram: `whatsapp_baileys:` é o nome antigo e continua
   * gravado em conversa de antes da renomeação. Sem as duas, metade da caixa de entrada daquele
   * número sumiria pra quem tem o recorte.
   *
   * Nada marcado = vê todos, que é o comportamento de sempre.
   */
  const numerosPermitidos = escopoPermitido(sessao.user.permissoes, ESCOPOS.numerosDeWhatsApp);
  const recorte = numerosPermitidos
    ? { contaCanal: { in: numerosPermitidos.flatMap((n) => grafiasDoContaCanal(n)) } }
    : {};

  const linhas = await prisma.conversa.findMany({
    where: { ...where, ...recorte },
    orderBy: { atualizadoEm: "desc" },
    // A foto do contato ligado entra como reserva da foto da conversa. Ver abaixo.
    include: { contatoVinculado: { select: { fotoUrl: true } } },
  });

  // Conversa sem foto herda a do contato. As duas colunas são preenchidas pelo mesmo webhook, mas
  // saem de sincronia sozinhas: quem já tinha conversa antes da foto passar a ser buscada ficou com
  // `Conversa.fotoUrl` nulo pra sempre, enquanto o contato ganhou a foto depois, por outro caminho.
  // O sintoma era o rosto aparecer no funil e a mesma pessoa continuar como iniciais em Conversas.
  const comFoto = linhas.map(({ contatoVinculado, ...c }) => ({
    ...c,
    fotoUrl: c.fotoUrl ?? contatoVinculado?.fotoUrl ?? null,
  }));

  // Segunda via, por NOME: nem toda conversa tem a FK preenchida (as criadas antes da coluna
  // existir, e as do Instagram quando "levar para o funil" está desligado, não têm contatoId).
  // Nesses casos o contato existe e tem a foto, só não está ligado: e é o mesmo nome dos dois
  // lados, porque quem cria os dois é o mesmo webhook.
  const semFoto = comFoto.filter((c) => !c.fotoUrl).map((c) => c.nome);
  if (semFoto.length) {
    const contatos = await prisma.contato.findMany({
      where: { workspaceId: sessao.user.workspaceId, nome: { in: semFoto }, fotoUrl: { not: null } },
      select: { nome: true, fotoUrl: true },
    });
    const porNome = new Map(contatos.map((c) => [c.nome, c.fotoUrl]));
    for (const c of comFoto) if (!c.fotoUrl) c.fotoUrl = porNome.get(c.nome) ?? null;
  }

  // Quando foi a ÚLTIMA MENSAGEM de cada conversa. Diferente de `atualizadoEm`, que é "última vez
  // que a linha foi tocada" e sobe por qualquer coisa (favoritar, mudar status, uma importação).
  // Era por isso que o funil inteiro parecia recente: uma importação encostou em todas as conversas
  // no mesmo minuto. É um `groupBy` de máximo. Não lê o texto de mensagem nenhuma.
  const ultimas = await prisma.mensagemExtra.groupBy({
    by: ["contato"],
    where: { workspaceId: sessao.user.workspaceId, contato: { in: comFoto.map((c) => c.nome) } },
    _max: { criadoEm: true },
  });
  const ultimaPorContato = new Map(ultimas.map((u) => [u.contato, u._max.criadoEm]));

  const comAtividade = comFoto.map((c) => ({
    ...c,
    // `null` quando a conversa ainda não tem mensagem gravada. Quem lê cai na data de criação.
    ultimaMensagemEm: ultimaPorContato.get(c.nome) ?? null,
  }));

  return NextResponse.json(comAtividade, { headers: cabecalhosComEtag(etag) });
}

/**
 * POST cria uma conversa individual vazia (sem mensagem ainda). Usado quando a usuária quer ser a
 * PRIMEIRA a escrever pra alguém, ex.: um participante de grupo que ela nunca conversou fora do
 * grupo. Se já existir uma conversa com esse `contato` (telefone) no workspace, devolve ela em vez
 * de duplicar.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { nome, contato, canal, contaCanal } = (await request.json()) as {
    nome?: string;
    contato?: string;
    canal?: string;
    contaCanal?: string | null;
  };
  if (!nome?.trim() || !contato?.trim()) {
    return NextResponse.json({ erro: "nome e contato são obrigatórios" }, { status: 400 });
  }

  /**
   * O NÚMERO É GUARDADO NA FORMA CANÔNICA (DDI + DDD + 9), e não como foi digitado.
   *
   * Contato salvo à mão quase sempre vem sem o 55: a pessoa digita "(41) 98487-7482", que é como
   * se escreve telefone no Brasil. Mandando assim pro WhatsApp, o envio não acha destinatário
   * nenhum — e o erro aparece só na hora de mandar, depois de escrever a mensagem.
   *
   * Vale também pra DEDUPLICAR: a mesma pessoa salva com e sem DDI caía em duas conversas, cada
   * uma com metade do histórico.
   *
   * Só pro WhatsApp. No Instagram o `contato` é o IGSID, um identificador — passá-lo por um
   * normalizador de telefone o estragaria.
   */
  const ehWhatsApp = (canal ?? "WhatsApp") === "WhatsApp";
  const normalizado = ehWhatsApp ? normalizarTelefoneParaComparacao(contato) : "";
  const contatoFinal = normalizado.length >= 12 ? normalizado : contato.trim();

  const existente = await prisma.conversa.findFirst({
    where: { workspaceId: sessao.user.workspaceId, contato: contatoFinal, ehGrupo: false },
  });
  if (existente) return NextResponse.json(existente);

  /*
   * O NOME JÁ É DE OUTRO NÚMERO: a janela nova nasce com o telefone no nome.
   *
   * "Eu peguei esse número no contato, selecionei pra mandar pela API oficial, e na hora que enviou
   * mandou pra um número antigo. (…) Cada WhatsApp é independente. Independente. Se eu quiser
   * mandar para o número novo, ele tem que abrir uma janela nova."
   *
   * A busca logo acima é pelo TELEFONE, que é o certo: número que já tem thread reusa a thread. O
   * `create` abaixo, porém, gravava o nome do contato cru — e `[workspaceId, nome]` é único. Com
   * uma conversa antiga do mesmo nome e outro telefone, dava dois resultados, os dois ruins:
   * estourava na chave única e a conversa não nascia, ou, pelos caminhos que buscam por nome, a
   * mensagem ia pra thread velha, com o número velho. Quando o número velho ainda existe, ela
   * CHEGA — na pessoa errada.
   *
   * Agora o nome é escolhido entre os que estão livres (ver `nomeLivreParaConversa`): o nome limpo
   * quando ninguém o ocupa, que é o caso comum e segue igual; e `Nome (+55 …)` quando é de outro
   * número. A thread antiga não é renomeada: ela continua com o nome, o histórico e o telefone
   * dela.
   */
  const comMesmoNome = await prisma.conversa.findMany({
    where: { workspaceId: sessao.user.workspaceId, nome: { startsWith: nome.trim() } },
    select: { nome: true },
  });
  const nomeFinal = nomeLivreParaConversa(
    nome,
    contatoFinal,
    comMesmoNome.map((c) => c.nome),
  );

  // As iniciais saem do nome QUE A PESSOA DIGITOU, não do nome final: com o telefone no nome, o
  // avatar viraria "C+" em vez de "CS".
  const iniciais =
    nome
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "?";

  /*
   * POR QUAL NÚMERO ESTA CONVERSA FALA, conferido contra as conexões da empresa.
   *
   * Sem isto a conversa nascia sem dono. Numa caixa de entrada dividida por número — e ela é, desde
   * que a aba "Todos" saiu — sem dono quer dizer que ela só aparece na aba das conversas antigas:
   * a pessoa abre a janela e não a encontra em lugar nenhum.
   *
   * O valor VEM DO NAVEGADOR, então é conferido aqui: um `contaCanal` qualquer faria a conversa
   * dizer que pertence a uma conexão que não existe (ou, pior, à de outro canal), e o envio
   * escolheria a integração errada. Não casando com nenhuma conexão, fica nulo — que é o
   * comportamento de antes, e é honesto.
   */
  const chavesConectadas = new Set(
    (await numerosDeWhatsApp(sessao.user.workspaceId)).map((n) => n.chave).filter(Boolean),
  );
  const donoFinal = contaCanal && chavesConectadas.has(contaCanal) ? contaCanal : null;

  const criada = await prisma.conversa.create({
    data: {
      id: `conversa-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      nome: nomeFinal,
      initials: iniciais,
      canal: canal ?? "WhatsApp",
      contato: contatoFinal,
      contaCanal: donoFinal,
    },
  });
  return NextResponse.json(criada);
}
