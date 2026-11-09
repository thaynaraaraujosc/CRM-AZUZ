import { prisma } from "@/lib/prisma";
import { idDeCardSemChave, idDoCard } from "@/lib/funis/id-do-card";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import { avaliarNoDeGatilho, type EventoAutomacao } from "@/lib/automation-flow/avaliacao";
import { gatilhosQueCasam } from "@/lib/automation-flow/gatilhos-do-fluxo";
import { anotarNaLinhaDoTempo, marcarExecucaoDeAutomacao } from "@/lib/integracoes/instagram-eventos";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { continuarComResposta, iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { gatilhoServeAoFormulario } from "@/lib/automation-flow/formulario-do-gatilho";
import { dispararGatilhosDoLead } from "@/lib/funil/gatilhos-etapa";
import { emSegundoPlano } from "@/lib/automacoes/segundo-plano";

/**
 * Dispara as automações quando chega uma mensagem. Do lado do SERVIDOR, a partir do webhook.
 *
 * Antes disto, o motor só rodava no navegador (painel "Testar" do editor de fluxos) e as mensagens
 * eram apenas simuladas. Na prática isso queria dizer que automação nenhuma funcionava de verdade:
 * dependia de alguém estar com a tela aberta. Atendimento não funciona assim: a mensagem chega de
 * madrugada e a resposta tem que sair.
 *
 * O motor em si continua síncrono e puro. Como `Ligacoes` não é assíncrono, aqui ele só ANOTA o
 * que deve acontecer; a gravação no banco e o envio de verdade acontecem depois, já com `await`.
 */
export async function dispararAutomacoesDeMensagemRecebida(params: {
  workspaceId: string;
  contatoNome: string;
  /** "WhatsApp" | "Instagram": o rótulo do canal da conversa, como fica em `Conversa.canal`. */
  canal: string;
  textoRecebido: string;
  /** Id da opção escolhida, quando a mensagem foi um clique em botão/lista/resposta rápida. */
  idDaOpcao?: string;
}): Promise<void> {
  await dispararAutomacoes({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    canal: params.canal,
    textoRecebido: params.textoRecebido,
    idDaOpcao: params.idDaOpcao,
    tipoGatilho: "mensagem_recebida",
  });

  /*
   * A MESMA MENSAGEM TAMBÉM ACORDA OS GATILHOS DA ETAPA em que o lead está.
   *
   * É o que faz "quando alguém de Follow-up responder, mova pra Qualificado" existir sem precisar
   * montar um robô de um passo só. O gatilho do fluxo continua sendo outro caminho, independente:
   * os dois podem existir ao mesmo tempo, e desligar um não desliga o outro.
   *
   * Em segundo plano e engolindo erro: responder o cliente é o que importa nesta função, e uma
   * falha aqui não pode derrubar o disparo do robô que já aconteceu acima.
   */
  emSegundoPlano("gatilho de etapa mensagem_recebida", () =>
    dispararGatilhosDoLead({
      workspaceId: params.workspaceId,
      contatoNome: params.contatoNome,
      tipoGatilho: "mensagem_recebida",
    }),
  );
}

/**
 * Dispara as automações de um evento do Instagram que NÃO é mensagem. Comentário, resposta a
 * comentário, reação, mídia, publicação compartilhada.
 *
 * Reaproveita o mesmo motor e as mesmas ações do resto do CRM de propósito: o Instagram é só a
 * origem do gatilho, e depois dele tudo que já existe (etiqueta, funil, tarefa, IA, atendente)
 * continua disponível. Um motor paralelo só pro Instagram significaria manter duas vezes cada
 * ação, e as duas divergiriam na primeira correção feita só de um lado.
 */
export async function dispararAutomacoesDeEventoInstagram(params: {
  workspaceId: string;
  contatoNome: string;
  tipoGatilho: string;
  textoRecebido: string;
  /** Id da publicação, quando o evento vier de uma. Permite a automação valer só pra ela. */
  publicacaoId?: string;
  /** Id do story respondido, quando a Meta o informa. Permite a automação valer só pra ele. */
  storyId?: string;
  /** Trava contra disparo repetido: "comentario:<id>". */
  chaveEvento?: string;
  instagramUserId?: string;
  /** Como responder ao comentário que disparou, quando o fluxo pedir isso. */
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  await dispararAutomacoes({ ...params, canal: "Instagram" });
}

/**
 * Dispara as automações de um evento do CRM. Entrar numa etapa do funil, virar lead novo.
 *
 * Estes gatilhos rodavam no NAVEGADOR: quem arrastasse o card via um aviso na tela e nada mais.
 * Duas consequências ruins: a automação não acontecia quando o card se movia por qualquer outro
 * caminho (webhook, importação, outra aba), e quando acontecia era só um toast, não a mensagem.
 */
export async function dispararAutomacoesDoCrm(params: {
  workspaceId: string;
  contatoNome: string;
  tipoGatilho: string;
  funilId?: string;
  etapaId?: string;
  etapaTitulo?: string;
  /**
   * DE QUAL FORMULÁRIO veio o evento, quando o gatilho é "formulário preenchido".
   *
   * Sem isto, todo robô de formulário disparava para TODO formulário — do CRM e do AZUZ Flow —, e
   * não havia como uma resposta ser diferente da outra. Ver `formulario-do-gatilho.ts`: lá está o
   * prefixo que separa os dois produtos e a regra de compatibilidade.
   */
  formularioId?: string;
  /** Trava contra disparo repetido: "etapa:<cardId>:<etapaId>". */
  chaveEvento?: string;
}): Promise<void> {
  await dispararAutomacoes({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    canal: "CRM",
    textoRecebido: "",
    tipoGatilho: params.tipoGatilho,
    funilId: params.funilId,
    etapaId: params.etapaId,
    etapaTitulo: params.etapaTitulo,
    formularioId: params.formularioId,
    chaveEvento: params.chaveEvento,
  });
}

async function dispararAutomacoes(params: {
  workspaceId: string;
  contatoNome: string;
  canal: string;
  textoRecebido: string;
  tipoGatilho: string;
  idDaOpcao?: string;
  funilId?: string;
  etapaId?: string;
  etapaTitulo?: string;
  publicacaoId?: string;
  storyId?: string;
  /** De qual formulário veio o evento. Ver `formulario-do-gatilho.ts`. */
  formularioId?: string;
  chaveEvento?: string;
  instagramUserId?: string;
  responderComentario?: (texto: string) => Promise<void>;
}): Promise<void> {
  const { workspaceId, contatoNome, canal, textoRecebido } = params;

  // Antes de avaliar gatilho nenhum: alguma automação está ESPERANDO a resposta desta pessoa?
  // Se está, esta mensagem é a continuação dela. Não o começo de outra. Sem esta checagem,
  // responder "1" a uma pergunta receberia o fluxo inteiro de novo por cima.
  if (params.tipoGatilho === "mensagem_recebida") {
    const continuou = await continuarComResposta({
      workspaceId,
      contatoNome,
      texto: textoRecebido,
      idDaOpcao: params.idDaOpcao,
    }).catch((erro) => {
      console.error("[automacao] falha ao continuar execução em espera:", erro);
      return false;
    });
    if (continuou) return;
  }

  const linhas = await prisma.fluxoAutomacao.findMany({
    where: { workspaceId, status: "publicado", ativa: true, arquivada: false },
  });
  if (!linhas.length) return;

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    /*
     * O RASTREIO DE ORIGEM VEM JUNTO, e é o que destrava decidir por ele dentro da automação.
     *
     * `OrigemDoLead` guarda UTM, código do clique e os ids de campanha/conjunto/anúncio desde que
     * o rastreio de tráfego existe. Até aqui nenhuma automação conseguia ler nada disso: dava pra
     * mandar a venda de volta pro Google, e não dava pra responder diferente a quem chegou pelo
     * anúncio. É uma relação 1-1 opcional, então o `include` custa um join e nada mais.
     */
    include: { origemDoLead: true },
  });

  const contato = {
    // `etiquetas` vem como Json do banco (pode ser null) e o motor espera sempre uma lista. Por
    // isso é normalizada DEPOIS do espalhamento, não antes.
    ...(contatoNoBanco ?? {}),
    ...rastreioParaCondicoes(contatoNoBanco?.origemDoLead),
    nome: contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    // Disponíveis pras condições do fluxo ("mensagem contém…", "canal é…").
    canal: canalDoGatilho(canal),
    mensagem: textoRecebido,
    // O COMENTÁRIO é um campo próprio, e não só "a mensagem": num fluxo que responde comentário e
    // segue no Direct, "o que a pessoa comentou" e "o que ela respondeu no Direct" são duas
    // coisas diferentes, e as duas precisam poder ser perguntadas depois.
    ...(ehGatilhoDeComentario(params.tipoGatilho) ? { comentario: textoRecebido } : {}),
    ...(params.funilId ? { funilId: params.funilId } : {}),
    ...(params.etapaTitulo ? { etapaTitulo: params.etapaTitulo } : {}),
  };

  const areaDoEvento = areaDoCanal(canal);

  for (const linha of ordemDeDisparo(linhas)) {
    const fluxo = linha as unknown as FluxoAutomacao;

    // Robô social não atende WhatsApp, robô comercial não atende Direct. Sem isto, um fluxo de
    // "mensagem recebida" montado pro funil responderia também a quem escreve no Instagram, com
    // uma conversa pensada pra outro canal.
    if (!areaCombina(fluxo, areaDoEvento)) continue;

    /*
     * QUAL DOS BLOCOS DE GATILHO este evento aciona.
     *
     * Dois motivos para haver mais de um candidato. Um evento pode casar com tipos diferentes —
     * uma mensagem que chega serve pra "Mensagem recebida", "Palavra-chave recebida" e "Lead
     * respondeu", três formas de dizer a mesma coisa. E o fluxo pode ter VÁRIOS blocos de gatilho
     * (ver `gatilhos-do-fluxo.ts`): a mesma automação responde a comentário e a resposta de story.
     *
     * Os filtros abaixo são por BLOCO, não por fluxo: o formulário escolhido, as palavras, a
     * publicação, o story. Por isso a busca é um laço que para no primeiro bloco que aceita tudo,
     * em vez de pegar o primeiro bloco e testar o fluxo inteiro contra ele.
     */
    const candidatos = gatilhosQueCasam(fluxo.nodes, params.tipoGatilho);
    if (!candidatos.length) continue;

    // A etapa é a dona do gatilho quando existe um gatilho de etapa apontando pra este fluxo.
    // Sem esta checagem, um fluxo com bloco de gatilho E linha em GatilhoEtapa dispararia DUAS
    // vezes pro mesmo lead: o bloco por aqui, a etapa pelo outro caminho.
    if (params.etapaId && (await etapaJaDisparaEsteFluxo(workspaceId, linha.id, params.etapaId))) {
      continue;
    }

    const evento = (tipoAceito: string) => ({
      tipo: tipoAceito as EventoAutomacao["tipo"],
      contatoNome,
      canal: canalDoGatilho(canal),
      mensagem: textoRecebido,
      ...(params.funilId ? { funilId: params.funilId } : {}),
      ...(params.etapaId ? { etapaId: params.etapaId } : {}),
      ...(params.publicacaoId ? { publicacaoId: params.publicacaoId } : {}),
      ...(params.storyId ? { storyId: params.storyId } : {}),
    });

    /*
     * O PRIMEIRO BLOCO QUE ACEITA TUDO, e é ele que decide por onde a execução começa.
     *
     * Cada checagem aqui é do bloco, não do fluxo:
     *
     * - DE QUAL FORMULÁRIO. O bloco "Formulário preenchido" sempre teve este campo e ninguém o
     *   lia, porque o disparo não mandava de qual formulário o evento vinha — então todo robô de
     *   formulário respondia a todo formulário, do CRM e do Flow.
     * - AS CONDIÇÕES DO BLOCO (palavras, publicação, story, janela de horário).
     * - O CANAL escrito no bloco: um fluxo de WhatsApp não pode responder no Instagram só porque
     *   chegou mensagem de lá. A comparação normaliza os dois lados, e isso NÃO é preciosismo: os
     *   blocos do Instagram guardam `canal: "Instagram"` com maiúscula e a conversa chega em
     *   minúscula — com a comparação crua, todo fluxo de Instagram da biblioteca era descartado
     *   aqui, em silêncio.
     * - TER SAÍDA. Bloco de gatilho sem aresta não leva a passo nenhum.
     */
    let escolhido: { no: (typeof fluxo.nodes)[number]; tipoAceito: string; aresta: (typeof fluxo.edges)[number] } | null =
      null;
    for (const { no, tipoAceito } of candidatos) {
      const dadosDoBloco = no.data as { formularioId?: string; canal?: string } | undefined;
      if (!gatilhoServeAoFormulario(dadosDoBloco?.formularioId, params.formularioId)) continue;
      if (!avaliarNoDeGatilho(fluxo, no, evento(tipoAceito))) continue;
      const canalDoBloco = dadosDoBloco?.canal;
      if (canal !== "CRM" && canalDoBloco && !mesmoCanal(canalDoBloco, canal)) continue;
      const aresta = fluxo.edges.find((e) => e.source === no.id);
      if (!aresta) continue;
      escolhido = { no, tipoAceito, aresta };
      break;
    }
    if (!escolhido) continue;


    // Trava de idempotência: o mesmo comentário nunca executa o mesmo fluxo duas vezes. A Meta
    // reenvia webhook rotineiramente, e sem isto a pessoa receberia a mesma resposta repetida.
    if (params.chaveEvento) {
      const primeiraVez = await marcarExecucaoDeAutomacao({
        workspaceId,
        fluxoId: linha.id,
        chaveEvento: params.chaveEvento,
        instagramUserId: params.instagramUserId,
      });
      if (!primeiraVez) continue;
    }

    // Um motor só, o com estado. O antigo (síncrono, sem memória) foi removido: ele não sabia
    // esperar, engolia as opções de uma pergunta e mantinha uma segunda lista de blocos que
    // divergia da primeira a cada correção feita só de um lado.
    {
      const fim = await iniciarFluxoComEstado({
        workspaceId,
        fluxoId: linha.id,
        gatilho: params.tipoGatilho,
        /*
         * POR QUAL BLOCO o evento entrou.
         *
         * Com vários gatilhos no mesmo fluxo, o tipo já não identifica o bloco: dois gatilhos de
         * comentário filtrando palavras diferentes têm o mesmo tipo e saídas que podem ir pra
         * passos diferentes. Quem acabou de escolher o bloco foi o laço acima, e passar o id é o
         * que impede a execução de recomeçar essa decisão com menos informação do que ela tinha.
         */
        gatilhoNoId: escolhido.no.id,
        configuracoes: linha.configuracoes as never,
        publicarSeFaltar: {
          versao: Math.max(1, Number(linha.versaoAtual ?? 1)),
          nodes: fluxo.nodes,
          edges: fluxo.edges,
          configuracoes: fluxo.configuracoes,
        },
        contatoNome,
        contatoId: contatoNoBanco?.id ?? null,
        contato,
        responderComentario: params.responderComentario,
      }).catch((erro) => {
        console.error(`[automacao] fluxo ${linha.id} falhou no motor com estado:`, erro);
        return null;
      });
      // `null` = fluxo sem versão publicada, ou sem nada ligado no gatilho. Executar o rascunho
      // aqui seria mandar pro cliente o que alguém está editando agora. Não roda, e o aviso fica
      // no log pra a causa aparecer.
      if (!fim) {
        console.warn(`[automacao] fluxo ${linha.id} não tem versão publicada pra rodar`);
        continue;
      }
      /*
       * BARRADA ANTES DE COMEÇAR não é "começou".
       *
       * O limite de execução, o horário de funcionamento e a regra de outras automações ao mesmo
       * tempo devolvem "cancelada" sem nunca ter criado execução. A anotação na linha do tempo e o
       * +1 no contador saíam assim mesmo: o contato tinha "a automação X começou" registrado numa
       * hora em que nada foi enviado, e o número ao lado do robô contava disparos que não houve.
       */
      if (fim.naoIniciou) {
        console.log(`[automacao] fluxo "${linha.nome}" não iniciou:`, fim.detalhe);
        continue;
      }
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal,
        tipo: "automacao_iniciou",
        descricao: `automação "${linha.nome}" começou`,
        dados: { fluxoId: linha.id },
      });
      await prisma.fluxoAutomacao.update({ where: { id: linha.id }, data: { execucoes: { increment: 1 } } }).catch(() => {});
      console.log(`[automacao] fluxo "${linha.nome}" executado`, fim);
    }
  }
}

/** O peso de cada prioridade na fila. Menor roda antes. */
const PESO_DA_PRIORIDADE: Record<string, number> = { alta: 0, normal: 1, baixa: 2 };

/**
 * A ORDEM EM QUE AS AUTOMAÇÕES DO MESMO EVENTO SÃO DISPARADAS.
 *
 * Enquanto todas rodavam, a ordem não tinha consequência: as três respondiam e pronto. Com a regra
 * de "outras automações ao mesmo tempo", a ordem passa a DECIDIR qual delas fala — a primeira a
 * começar é a que fica viva, e as seguintes encontram o contato ocupado. Deixar isso por conta da
 * ordem que o banco devolveu seria sortear, a cada evento, qual robô atende o cliente.
 *
 * Quem decide é a "Prioridade", que existia nas configurações desde sempre e não era lida por
 * ninguém: alta antes de normal, normal antes de baixa. Empate vai por nome, pra a ordem ser a
 * mesma em todo disparo e dar pra explicar por que aquele robô falou.
 *
 * Exportada pra teste: é decisão de roteamento, não detalhe interno.
 */
export function ordemDeDisparo<T extends { nome: string; configuracoes: unknown }>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) => {
    const pa = PESO_DA_PRIORIDADE[prioridadeDaLinha(a.configuracoes)] ?? 1;
    const pb = PESO_DA_PRIORIDADE[prioridadeDaLinha(b.configuracoes)] ?? 1;
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

function prioridadeDaLinha(configuracoes: unknown): string {
  const valor = (configuracoes as { prioridade?: unknown } | null | undefined)?.prioridade;
  return typeof valor === "string" ? valor : "normal";
}

/** De qual área é o evento. O canal da conversa é o que decide. Exportado pra teste: é decisão
 * de roteamento, não detalhe interno, e errar aqui faz robô responder no canal errado. */
export function areaDoCanal(canal: string): AreaAutomacao {
  return canal === "Instagram" ? "social" : "comercial";
}

/**
 * O fluxo atende eventos desta área?
 *
 * Fluxo SEM área é fluxo criado antes desta coluna existir, e aí a resposta é sim: mudar o
 * comportamento de um robô que já está rodando na conta de alguém, por causa de um campo novo,
 * seria quebrar automação em produção sem ninguém pedir. Quem decide nesses é o canal do bloco de
 * gatilho, como sempre foi. Fluxo COM área declarada obedece a área, que é o ponto de ter o campo.
 */
export function areaCombina(fluxo: FluxoAutomacao, areaDoEvento: AreaAutomacao): boolean {
  if (!fluxo.area) return true;
  return fluxo.area === areaDoEvento;
}


/** Gatilhos cujo texto recebido é um COMENTÁRIO, e não uma mensagem de conversa. */
const GATILHOS_DE_COMENTARIO = new Set([
  "comentario_instagram",
  "comentario_tiktok",
  "instagram_resposta_comentario",
  "instagram_comentario_live",
]);

export function ehGatilhoDeComentario(tipo: string): boolean {
  return GATILHOS_DE_COMENTARIO.has(tipo);
}

/* A tradução das colunas de origem pros campos da condição mora em `rastreio/para-condicoes.ts`:
   dois lugares montam o contexto do contato, e com ela escrita num só metade dos robôs enxergava
   a origem do lead. O re-export mantém quem já importava daqui. */
import { rastreioParaCondicoes } from "@/lib/rastreio/para-condicoes";
export { rastreioParaCondicoes } from "@/lib/rastreio/para-condicoes";

/** O gatilho guarda o canal em minúsculas ("whatsapp"/"instagram"); a conversa guarda o rótulo. */
function canalDoGatilho(canalDaConversa: string): string {
  return canalDaConversa.toLowerCase();
}

/**
 * O canal escrito no bloco de gatilho é o mesmo da conversa?
 *
 * Exportado pra teste porque é a comparação que já esteve errada: os blocos de Instagram gravam
 * "Instagram" e a conversa chega como "instagram", e a diferença de uma letra maiúscula fazia o
 * fluxo inteiro nunca disparar, sem erro em lugar nenhum.
 */
export function mesmoCanal(canalDoBloco: string, canalDaConversa: string): boolean {
  return canalDoBloco.trim().toLowerCase() === canalDaConversa.trim().toLowerCase();
}

/** Move (ou cria) o card do contato na etapa pedida. */
async function moverCardDeEtapa(
  workspaceId: string,
  contatoNome: string,
  funilId: string,
  etapaTitulo: string,
): Promise<void> {
  const etapa = await prisma.funilEtapa.findFirst({ where: { funilId, titulo: etapaTitulo } });
  if (!etapa) return;

  const card = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome } });
  if (card) {
    await prisma.negocioCard.update({ where: { id: card.id }, data: { etapaId: etapa.id } });
    return;
  }

  const id = idDoCard(workspaceId, contatoNome);
  try {
    await prisma.negocioCard.create({
      data: {
        id: id ?? idDeCardSemChave(workspaceId),
        etapaId: etapa.id,
        ordem: 0,
        workspaceId,
        nome: contatoNome,
        valor: "-",
        origem: "Automação",
        dias: "Hoje",
        data: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (erro) {
    // Chamada concorrente criou primeiro: move o card dela em vez de criar um segundo.
    if (!ehChaveDuplicada(erro) || !id) throw erro;
    await prisma.negocioCard.update({ where: { id }, data: { etapaId: etapa.id } });
  }
}

/**
 * A etapa já executa este fluxo por conta própria?
 *
 * É a pergunta que separa "o gatilho mora no bloco" de "o gatilho mora na etapa". Com a linha em
 * `GatilhoEtapa`, quem dispara é a etapa, e o bloco de gatilho vira só desenho: continua no canvas
 * (pra dar pra voltar atrás) mas não aciona nada.
 */
async function etapaJaDisparaEsteFluxo(workspaceId: string, fluxoId: string, etapaId: string): Promise<boolean> {
  const gatilho = await prisma.gatilhoEtapa.findFirst({
    where: { workspaceId, fluxoId, etapaId, ativo: true },
    select: { id: true },
  });
  return !!gatilho;
}
