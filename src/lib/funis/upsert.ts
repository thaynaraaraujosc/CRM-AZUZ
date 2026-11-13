import { prisma } from "@/lib/prisma";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import { idDeCardSemChave, idDoCard } from "./id-do-card";

/**
 * OS negócios daquele contato, achados pelo nome NORMALIZADO.
 *
 * O banco compara texto com texto, e o mesmo contato chega com o nome escrito de jeitos diferentes
 * conforme o caminho: espaço sobrando no fim, maiúsculas do nome de perfil, espaço duplo no meio.
 * Buscar por igualdade exata fazia o CRM não achar o card que já existia (e criar outro) e não
 * achar o card pra subir pro topo quando chegava mensagem.
 *
 * Devolve LISTA, e não um card: desde que a mesma pessoa pode estar em mais de um funil (um por
 * número que fala com ela), "o card dela" não existe mais como pergunta. Quem precisa de um só
 * precisa dizer de qual funil — é o que faz `cardDoContatoNoFunil`.
 *
 * Sempre varre, e não só quando a igualdade exata falha: parar no primeiro acerto deixaria de fora
 * o card gravado com outra grafia do mesmo nome, que é justamente o caso que a normalização existe
 * pra cobrir. A varredura é limitada ao workspace.
 */
async function cardsDoContato(workspaceId: string, contatoNome: string) {
  const exatos = await prisma.negocioCard.findMany({ where: { workspaceId, nome: contatoNome } });
  const chave = chaveDeContato(contatoNome);
  if (!chave) return exatos;

  // A varredura normalizada acha as outras grafias ("Thais " com espaço, "LUCAS" em maiúsculas) e
  // os cards já encontrados pela igualdade exata; o `Set` de ids evita devolver alguém duas vezes.
  const jaAchados = new Set(exatos.map((c) => c.id));
  const candidatos = await prisma.negocioCard.findMany({ where: { workspaceId } });
  return exatos.concat(
    candidatos.filter((c) => !jaAchados.has(c.id) && chaveDeContato(c.nome) === chave),
  );
}

/**
 * O MESMO, MAS DENTRO DE UM FUNIL SÓ. É a pergunta certa pra decidir se um lead entra.
 *
 * "Por mais que eu esteja conversando com essa pessoa por 2 WhatsApp, ela tem que estar nos 2
 * funis e não só em 1." A conferência era do workspace inteiro: card em QUALQUER funil respondia
 * "já tem" e o lead não entrava no funil do outro número. Com dois números — a API oficial no
 * principal e o celular do closer no QR Code — isso quer dizer que o segundo funil nunca recebia
 * ninguém que já tivesse falado pelo primeiro.
 *
 * A pergunta do workspace inteiro continua existindo (`cardDoContato`), porque ela é a certa pra
 * quem quer MOVER o card da pessoa; ela só não é a certa pra quem quer saber se falta criar um.
 */
/*
 * Exportada porque a lista do Flow faz exatamente esta pergunta antes de decidir entre "manter" e
 * "mover". Uma segunda implementação divergiria na primeira correção — e a comparação por nome
 * normalizado, que mora aqui, é justamente o que impediu a mesma pessoa de ganhar dois cards.
 */
export async function cardDoContatoNoFunil(workspaceId: string, contatoNome: string, funilId: string) {
  const exato = await prisma.negocioCard.findFirst({
    where: { workspaceId, nome: contatoNome, etapa: { funilId } },
  });
  if (exato) return exato;

  const chave = chaveDeContato(contatoNome);
  if (!chave) return null;
  const candidatos = await prisma.negocioCard.findMany({ where: { workspaceId, etapa: { funilId } } });
  return candidatos.find((c) => chaveDeContato(c.nome) === chave) ?? null;
}

/**
 * Coloca um lead recém-criado na primeira etapa (menor `ordem`, não pelo nome: o workspace pode
 * ter chamado a primeira etapa de "Novo", "Entrada", "Lead recebido" etc.) do primeiro funil do
 * workspace. Regra de negócio: TODO novo lead entra no funil, sempre pela primeira etapa.
 *
 * Só chame isso quando o contato ACABOU de ser criado nesta mesma chamada (nunca pra um contato
 * que já existia): mover um contato existente de etapa é decisão do usuário, jamais automática só
 * porque chegou mais uma mensagem dele. Idempotente por natureza: se por algum motivo o contato já
 * tiver um card em qualquer funil (reprocessamento do mesmo evento, corrida entre dois webhooks),
 * não duplica.
 *
 * "Não duplica" passou a valer TAMBÉM pra chamadas simultâneas, e não só pra sequenciais. A
 * conferência de card existente é um passo separado do `create`, e nada impede duas chamadas de
 * passarem pelas duas ao mesmo tempo — foi assim que o teste com banco de verdade produziu dois
 * cards pra mesma pessoa. Agora quem garante é a chave primária do card, deduzida do nome: ver
 * `idDoCard`.
 */
export async function entrarNaPrimeiraEtapaComoNovoLead(params: {
  workspaceId: string;
  contatoNome: string;
  /** Conversa de grupo: grupo não entra no funil nem em automação (ver dentro da função). */
  ehGrupo?: boolean;
  origem: string;
  /** Conexão que originou o negócio. É o que faz o card sumir do funil quando aquele canal é
   * desconectado, e voltar quando ele reconecta (ver o campo no schema). */
  contaCanal?: string | null;
  /** Funil escolhido pra este tipo de lead. Ausente = o primeiro funil do workspace, como sempre. */
  funilId?: string | null;
  /** Etapa escolhida. Ausente = a primeira etapa daquele funil. */
  etapaId?: string | null;
}) {
  const { workspaceId, contatoNome, ehGrupo = false, origem, contaCanal } = params;

  // Grupo do WhatsApp nunca vira negócio. Um grupo não é um lead: ele existe no CRM só pra ser
  // respondido em Conversas, sem sair do sistema. A regra vive AQUI, e não só em quem chama, pra
  // valer pra qualquer caminho que venha a criar lead no futuro (importação, outro canal, gatilho
  // de automação) sem depender de cada um lembrar de checar.
  if (ehGrupo) return null;

  // Conversa arquivada também não vira negócio. Arquivar é o gesto de "isso aqui não está em
  // atendimento": se gerasse card, o funil voltaria a encher exatamente com o que a pessoa acabou
  // de tirar da caixa de entrada. Quando ela voltar a mandar mensagem a conversa desarquiva sozinha
  // (ver `upsertConversaAoReceberMensagem`), e aí sim entra no funil pelo caminho normal.
  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    select: { arquivada: true },
  });
  if (conversa?.arquivada) return null;

  // "Primeiro funil do workspace": mesma convenção já usada em outras telas (trafego/page.tsx,
  // funilAtivoId inicial em funis-context.tsx): o primeiro da lista, não um campo "principal"
  // dedicado (que não existe no schema). Workspace sem nenhum funil/etapa ainda: não há onde
  // colocar o lead: fica só como Contato, sem quebrar o recebimento da mensagem.
  //
  // `funilId`/`etapaId` são o destino ESCOLHIDO, quando existe um. É o que permite lead de
  // Instagram cair num funil próprio em vez de se misturar com o comercial. Sem escolha, ou com
  // uma escolha que já não existe (funil apagado), cai de volta na convenção acima: nunca deixar
  // o lead de fora do funil por causa de uma configuração desatualizada.
  const etapaEscolhida = params.etapaId
    ? await prisma.funilEtapa.findFirst({
        where: { id: params.etapaId, funil: { workspaceId } },
        include: { cards: { select: { ordem: true } } },
      })
    : null;


  const comPrimeiraEtapa = {
    etapas: { orderBy: { ordem: "asc" }, take: 1, include: { cards: { select: { ordem: true } } } },
  } as const;

  /*
   * O FUNIL SEM NÚMERO É A REDE DE SEGURANÇA, e não "o primeiro da lista".
   *
   * Era o primeiro que o banco devolvesse. Com um funil por número ("nenhum funil pode ter mais do
   * que um número; não pode receber mensagens de WhatsApps diferentes"), isso virou um defeito: o
   * lead de um número sem quadro próprio caía no quadro de OUTRO número — e quem atende por aquele
   * número liga pra quem não é dele.
   *
   * O funil sem número é justamente o que existe pra receber o que não tem quadro próprio. Não
   * havendo nenhum, o lead fica SEM CARD — e isso é a escolha certa, não um descuido: o contato e
   * a conversa continuam existindo, e no dia em que o funil daquele número for criado a
   * reconciliação traz todo mundo pra ele ("todas as conversas que tiver lá no chat do WhatsApp
   * daquele número vão vir para o funil que representa aquele número"). Ficar sem card é
   * recuperável; aparecer no quadro de outra pessoa não é — ela liga pra quem não é dela, e
   * ninguém descobre que o card estava no lugar errado.
   */
  const funil = etapaEscolhida
    ? null
    : (params.funilId
        ? await prisma.funil.findFirst({ where: { workspaceId, id: params.funilId }, include: comPrimeiraEtapa })
        : null) ??
      (await prisma.funil.findFirst({ where: { workspaceId, contaCanal: null }, include: comPrimeiraEtapa }));

  const primeiraEtapa = etapaEscolhida ?? funil?.etapas[0];
  if (!primeiraEtapa) return null;

  /*
   * A CONFERÊNCIA DE CARD EXISTENTE VEM DEPOIS DE SABER O FUNIL DE DESTINO, e por isso ela mudou
   * de lugar: antes era a primeira coisa que a função fazia, do workspace inteiro.
   *
   * "Por mais que eu esteja conversando com essa pessoa por 2 WhatsApp, ela tem que estar nos 2
   * funis e não só em 1." Com a pergunta ampla, um card em qualquer funil respondia "já tem" e o
   * lead não entrava no funil do outro número — foi por isso que a Cássia, chamada pela API
   * oficial, nunca apareceu no funil do Lucas.
   *
   * Dentro do MESMO funil nada mudou: quem já tem card não ganha outro e não muda de etapa, que
   * continua sendo decisão de quem atende. Comparação pelo nome NORMALIZADO, não por texto exato:
   * o mesmo contato chega escrito de jeitos diferentes conforme o caminho ("Thais " com espaço,
   * "LUCAS ARANTES" em maiúsculas), e comparar cru fazia a mesma pessoa ganhar um segundo card a
   * cada variação. Foi assim que a conta real chegou a 69 negócios pra 35 conversas.
   */
  const funilDestino = etapaEscolhida?.funilId ?? funil?.id;
  if (!funilDestino) return null;

  const jaTemCard = await cardDoContatoNoFunil(workspaceId, contatoNome, funilDestino);
  if (jaTemCard) return jaTemCard;

  // Lead novo entra no TOPO da coluna, não no fim. Como a listagem ordena por `ordem` crescente,
  // isso é uma ordem MENOR que a de todo mundo. Entrando no fim, quem acabou de mandar mensagem
  // caía embaixo de dezenas de cards antigos e a pessoa que atende só via o lead novo rolando a
  // coluna inteira: mensagem nova é justamente o que precisa ser visto primeiro.
  //
  // Fica negativo, e é de propósito: assim nenhum card existente precisa ser renumerado (o que
  // brigaria com a ordem que a pessoa arrumou na mão). O PUT de `/api/funis` normaliza tudo pra
  // 0..n na próxima vez que a tela salvar, mantendo a posição.
  const menorOrdem = primeiraEtapa.cards.reduce((min, c) => Math.min(min, c.ordem), 0);

  const id = idDoCard(workspaceId, contatoNome, funilDestino);
  try {
    return await prisma.negocioCard.create({
      data: {
        id: id ?? idDeCardSemChave(workspaceId),
        etapaId: primeiraEtapa.id,
        ordem: menorOrdem - 1,
        workspaceId,
        nome: contatoNome,
        valor: "-",
        origem,
        contaCanal,
        dias: "Hoje",
        data: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (erro) {
    // A chamada concorrente criou o card primeiro. Isso é a RESPOSTA, não um erro: devolve o card
    // dela, que é exatamente o que o caminho sequencial devolveria. Estourar aqui viraria 500 numa
    // entrega que deu certo, e o Flow repetiria tudo.
    if (!ehChaveDuplicada(erro)) throw erro;
    const doConcorrente = id
      ? await prisma.negocioCard.findUnique({ where: { id } })
      : await cardDoContatoNoFunil(workspaceId, contatoNome, funilDestino);
    // Sem o card da vencedora não há o que devolver: aí o erro é de verdade e sobe.
    if (!doConcorrente) throw erro;
    return doConcorrente;
  }
}

/**
 * ELA JÁ É CLIENTE, MAS É A PRIMEIRA VEZ QUE FALA POR ESTE NÚMERO: entra no funil deste número.
 *
 * "Eu chamei o número da Cássia pelo WhatsApp da versão oficial. Só que ela não foi pro funil do
 * Lucas." E: "por mais que eu esteja conversando com essa pessoa por 2 WhatsApp, ela tem que estar
 * nos 2 funis e não só em 1."
 *
 * `entrarNaPrimeiraEtapaComoNovoLead` só era chamado pra contato que ACABOU de nascer, e isso está
 * certo pro funil padrão: mensagem nova de quem já é cliente não pode criar negócio nem mover
 * ninguém de etapa. Mas quando a empresa tem dois números e cada um tem o seu quadro, a primeira
 * mensagem de alguém POR UM NÚMERO NOVO é um lead novo PARA AQUELE NÚMERO, mesmo que a pessoa já
 * exista no CRM há meses. Quem atende naquele número não tem como adivinhar que ela chegou.
 *
 * DUAS GUARDAS, e as duas importam:
 *
 * 1. SÓ COM FUNIL PRÓPRIO CONFIGURADO (`funilId`). Sem ele o número manda pro funil padrão, e
 *    criar card lá seria justamente o "mensagem nova ressuscita negócio" que não pode acontecer.
 * 2. SÓ NA PRIMEIRA MENSAGEM POR ESTE NÚMERO. É o que separa "chegou alguém aqui" de "mais uma
 *    mensagem de quem já estava". Sem isso, um card que a pessoa tirou do quadro de propósito
 *    voltaria na próxima mensagem — e tirar do funil é um gesto deliberado, com confirmação.
 *
 * A contagem inclui a mensagem que acabou de ser gravada (os dois webhooks gravam antes de chegar
 * aqui): `1` quer dizer que não havia nenhuma antes desta.
 */
export async function entrarNoFunilDoNumero(params: {
  workspaceId: string;
  contatoNome: string;
  ehGrupo?: boolean;
  origem: string;
  contaCanal?: string | null;
  /** O funil deste número. Sem ele não há nada a fazer: ver a guarda 1 acima. */
  funilId?: string | null;
}) {
  const { workspaceId, contatoNome, contaCanal, funilId } = params;
  if (params.ehGrupo || !funilId || !contaCanal) return null;

  const quantas = await prisma.mensagemExtra.count({
    where: {
      workspaceId,
      contato: contatoNome,
      // `whatsapp_baileys:` é o nome ANTIGO do canal de QR Code, ainda gravado em mensagem de
      // antes da renomeação. Sem os dois, a conta daria zero num número que conversa há meses e o
      // card entraria como se fosse a primeira vez.
      contaCanal: { in: [contaCanal, equivalenteAntigo(contaCanal)].filter((c): c is string => !!c) },
    },
  });
  if (quantas > 1) return null;

  return entrarNaPrimeiraEtapaComoNovoLead({
    workspaceId,
    contatoNome,
    ehGrupo: params.ehGrupo,
    origem: params.origem,
    contaCanal,
    funilId,
  });
}

/** A grafia antiga do mesmo `contaCanal`, quando existe. `null` quando não há equivalente. */
function equivalenteAntigo(contaCanal: string): string | null {
  const PREFIXO_NOVO = "whatsapp_nao_oficial:";
  const PREFIXO_ANTIGO = "whatsapp_baileys:";
  if (contaCanal.startsWith(PREFIXO_NOVO)) {
    return `${PREFIXO_ANTIGO}${contaCanal.slice(PREFIXO_NOVO.length)}`;
  }
  if (contaCanal.startsWith(PREFIXO_ANTIGO)) {
    return `${PREFIXO_NOVO}${contaCanal.slice(PREFIXO_ANTIGO.length)}`;
  }
  return null;
}

/**
 * Sobe o card de um contato pro TOPO da coluna em que ele está, quando chega mensagem nova dele.
 *
 * Não muda de ETAPA: isso continua sendo decisão de quem atende. Muda só a posição DENTRO da
 * coluna, pra a coluna funcionar como caixa de entrada: quem falou por último aparece primeiro, em
 * vez de ficar perdido no meio de dezenas de cards parados.
 *
 * Igual ao lead novo (ver acima), a ordem nova é MENOR que a de todo mundo da etapa. Negativa se
 * precisar. Nenhum outro card é renumerado, e o PUT de `/api/funis` normaliza pra 0..n no próximo
 * salvamento da tela.
 *
 * Falha em silêncio de propósito: isto é um detalhe de apresentação do funil, e uma mensagem nunca
 * pode deixar de ser gravada porque a reordenação não deu certo.
 */
export async function subirCardParaOTopo(workspaceId: string, contatoNome: string) {
  try {
    /*
     * TODOS OS CARDS DA PESSOA, não só o primeiro encontrado.
     *
     * Desde que a mesma pessoa pode estar em mais de um funil — um por número que fala com ela —,
     * pegar "o card dela" devolvia um e deixava o outro parado no meio da coluna. Quem acabou de
     * mandar mensagem precisa aparecer primeiro em todo quadro onde ela está: o quadro é a caixa de
     * entrada de quem atende por aquele número, e não é o número dele que decide se a mensagem
     * chegou.
     */
    const cards = await cardsDoContato(workspaceId, contatoNome);
    if (!cards.length) return;

    for (const card of cards) {
      const menor = await prisma.negocioCard.aggregate({
        where: { etapaId: card.etapaId },
        _min: { ordem: true },
      });
      const menorOrdem = menor._min.ordem ?? 0;
      // Já está no topo: não escreve à toa (o webhook roda a cada mensagem recebida).
      if (card.ordem <= menorOrdem) continue;

      await prisma.negocioCard.update({ where: { id: card.id }, data: { ordem: menorOrdem - 1 } });
    }
  } catch (erro) {
    console.error("[funil] falha ao subir o card pro topo:", erro);
  }
}
