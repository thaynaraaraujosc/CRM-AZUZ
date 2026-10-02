import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validarTokenWebhook, workspaceIdDaInstancia, buscarNumeroConectado, buscarInfoGrupo, buscarFotoPerfil } from "@/lib/integracoes/evolution";
import { criarContatoPeloWhatsAppSeNaoExistir } from "@/lib/contatos/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead, subirCardParaOTopo } from "@/lib/funis/upsert";
import { dispararAutomacoesDeMensagemRecebida } from "@/lib/automation-flow/disparar-no-servidor";
import { resolverPessoaDoTelefone } from "@/lib/conversas/identidade";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { registrarRespostaDeCampanha } from "@/lib/campanhas/resposta";
import { CANAL_NAO_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { iniciarHistoricoSeNecessario } from "@/lib/integracoes/historico-whatsapp";
import { registrarDescarte, registrarMensagemGravada, registrarSinalDeVida } from "@/lib/integracoes/sinal-de-vida";
import { decidirSobreLote } from "@/lib/integracoes/lote-de-mensagens";
import { chavesDaMensagem, desembrulharMensagem, extrairTextoDaMensagem } from "@/lib/integracoes/texto-da-mensagem";

/** Formato de evento que a Evolution API manda pro webhook configurado na instância. Mesmo body
 * pra todo tipo de evento, o que muda é `event` e o formato de `data`. */
type PayloadEvolution = {
  event: string;
  instance: string;
  data: Record<string, unknown>;
};

/** Mantém `historico` (progresso da sincronização sob demanda, ver `historico-whatsapp.ts`) intacto
 *. Sem isso, toda troca de status (QR renovado, reconexão) apagaria o progresso já feito, porque
 * `metadados` é uma coluna Json substituída inteira, não mesclada campo a campo pelo Prisma. */
async function atualizarStatus(
  workspaceId: string,
  status: "aguardando_qr" | "conectado" | "desconectado",
  extra: { qrDataUrl?: string | null; numero?: string | null } = {},
) {
  const atual = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  const metadadosAtuais = (atual?.metadados as Record<string, unknown>) ?? {};
  const metadados = { ...metadadosAtuais, qrDataUrl: extra.qrDataUrl ?? null, numero: extra.numero ?? null };

  await prisma.integracao.upsert({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    create: {
      id: `${workspaceId}-whatsapp_nao_oficial`,
      workspaceId,
      provedor: "whatsapp_nao_oficial",
      status,
      metadados,
    },
    update: { status, metadados, erroMensagem: null },
  });
}

/**
 * Recebe eventos da Evolution API (servidor próprio de WhatsApp via Baileys, ver
 * src/lib/integracoes/evolution.ts): autenticado por um token fixo na query string (não header
 * customizado, porque nem toda versão da Evolution permite configurar headers extra no webhook).
 */
/** Teto de tamanho do corpo do webhook. O CRM só lê texto, nunca mídia (ver comentário sobre
 * `base64: false` em `configurarWebhook()`), então um payload legítimo é sempre pequeno (poucos
 * KB). Um payload gigante só acontece se a Evolution mandar mídia embutida mesmo assim (bug dela
 * ou config divergente): rejeitar antes de `request.json()` evita que o processo do Node inteiro
 * trave/estoure memória tentando parsear um JSON de vários MB (bug real que já derrubou o
 * servidor inteiro, não só essa rota). */
const TAMANHO_MAXIMO_PAYLOAD_BYTES = 256 * 1024;

/**
 * Anota o descarte de um payload que é grande demais pra ser lido.
 *
 * O problema: pra saber de QUEM é a mensagem, o CRM precisa do campo `instance`, que está dentro do
 * corpo — e o motivo de rejeitar este payload é justamente não lê-lo (um JSON de vários MB já
 * derrubou o servidor inteiro ao ser parseado). O endereço do webhook é um só pra todos, com um
 * token que não diz nada sobre workspace, então não há de onde tirar o dono sem tocar no corpo.
 *
 * A saída é ler um PEDAÇO limitado: 2 KB do começo, onde a Evolution põe `event` e `instance`, e
 * achar o nome da instância por texto, sem parsear JSON nenhum. Se não achar, fica só o log. O que
 * não pode voltar a acontecer é o CRM responder "ok" pra uma mensagem que ele jogou fora e não
 * deixar rastro em lugar nenhum: era isso que tornava "não chegou" impossível de investigar.
 */
async function registrarDescartePelaInstancia(request: Request, motivo: string, detalhe: string) {
  try {
    const leitor = request.body?.getReader();
    if (!leitor) return;
    const { value } = await leitor.read();
    await leitor.cancel().catch(() => {});
    const inicio = new TextDecoder().decode(value?.slice(0, 2048) ?? new Uint8Array());
    const instancia = inicio.match(/"instance"\s*:\s*"([^"]+)"/)?.[1];
    const workspaceId = instancia ? workspaceIdDaInstancia(instancia) : null;
    if (workspaceId) await registrarDescarte(workspaceId, motivo, detalhe);
  } catch {
    // Anotar é o melhor esforço: nunca pode virar um erro em cima de um payload já rejeitado.
  }
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validarTokenWebhook(token)) {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  }

  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > TAMANHO_MAXIMO_PAYLOAD_BYTES) {
    console.log(`[webhook evolution] payload de ${tamanho} bytes rejeitado (provavelmente mídia embutida, não deveria vir mais)`);
    // Registra o descarte. Era um dos dois lugares em que a mensagem morria em silêncio: a
    // Evolution recebia `200 OK`, nada era gravado, e não havia como saber que tinha chegado.
    // Só dá pra anotar depois de resolver o workspace, que depende de ler o corpo: aqui ainda não
    // temos nenhum dos dois, então a anotação vai pelo caminho do token, que é por instância.
    await registrarDescartePelaInstancia(request, "payload grande", `${tamanho} bytes (provavelmente mídia embutida)`);
    return NextResponse.json({ ok: true });
  }

  const payload = (await request.json()) as PayloadEvolution;
  const workspaceId = workspaceIdDaInstancia(payload.instance ?? "");
  if (!workspaceId) return NextResponse.json({ ok: true }); // instância de outro uso do mesmo servidor Evolution

  const evento = payload.event?.toLowerCase().replace(/_/g, ".");

  // "A Evolution ainda está falando comigo." Sem esse rastro, "a mensagem não chegou" não tem como
  // ser investigado: não dá pra saber se ninguém avisou ou se o aviso chegou e foi descartado.
  await registrarSinalDeVida(workspaceId, evento ?? "desconhecido");

  if (evento === "qrcode.updated") {
    const qrDataUrl =
      (payload.data?.qrcode as { base64?: string } | undefined)?.base64 ??
      (payload.data?.base64 as string | undefined) ??
      null;
    await atualizarStatus(workspaceId, "aguardando_qr", { qrDataUrl });
    return NextResponse.json({ ok: true });
  }

  if (evento === "connection.update") {
    const estado = payload.data?.state as string | undefined;
    if (estado === "open") {
      const numero = await buscarNumeroConectado(workspaceId).catch(() => null);
      await atualizarStatus(workspaceId, "conectado", { numero });
      // Só a PRIMEIRA vez que esse workspace conecta. Reconexão (celular caiu e voltou) não deve
      // reprocessar o histórico inteiro de novo, só as mensagens novas (via `messages.upsert` normal).
      await iniciarHistoricoSeNecessario(workspaceId).catch((erro) =>
        console.error("[webhook evolution] Falha ao iniciar sincronização de histórico:", erro),
      );
    } else if (estado === "close") {
      await atualizarStatus(workspaceId, "desconectado");
    }
    return NextResponse.json({ ok: true });
  }

  if (evento === "messages.upsert") {
    // Processar ou descartar, e por quê: ver `decidirSobreLote`. Em resumo, o `type` do evento
    // deixou de ser motivo de descarte (no Baileys, "append" é como chega mensagem de GRUPO, não
    // histórico), e quem segura sincronização de histórico são o tamanho do lote e a idade de cada
    // mensagem — as duas travas que de fato funcionam.
    const decisao = decidirSobreLote(payload.data as { messages?: unknown[]; type?: string });
    if (decisao.acao === "descartar") {
      console.log(`[webhook evolution] lote descartado: ${decisao.motivo} — ${decisao.detalhe}`);
      await registrarDescarte(workspaceId, decisao.motivo, decisao.detalhe);
      return NextResponse.json({ ok: true });
    }
    /*
     * UMA MENSAGEM COM ERRO NÃO DERRUBA AS OUTRAS, E NÃO SOME EM SILÊNCIO.
     *
     * Sem este `try`, qualquer exceção no meio do laço fazia a rota responder 500: a mensagem que
     * falhou era perdida, as seguintes do mesmo lote nunca eram processadas, e não ficava rastro
     * nenhum no CRM — nem gravada, nem descartada. "Chegou no celular e não chegou aqui", sem nada
     * em lugar algum para investigar, que é o pior estado possível.
     *
     * O erro vira um descarte com a mensagem dele, que é o que aparece na tela de Configurações.
     */
    for (const item of decisao.mensagens) {
      try {
        await processarMensagemRecebida(workspaceId, item);
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        console.error("[webhook evolution] falha ao processar uma mensagem do lote:", erro);
        await registrarDescarte(workspaceId, "erro ao processar", motivo.slice(0, 300)).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true }); // evento que não precisamos tratar (ex.: presence.update)
}

/** Mensagem mandada/recebida há mais que isso é sincronização de histórico (conexão inicial ou
 * reconexão trazendo o backlog inteiro do celular), não mensagem ao vivo: não deve virar
 * conversa/lead novo no CRM. Único jeito confiável de filtrar isso, já que a Evolution nem sempre
 * marca `type` no evento (ver acima): comparar o timestamp da própria mensagem com agora. Ignorado
 * quando `permitirHistorico` é `true` (chamado pela sincronização de histórico sob demanda, ver
 * `POST .../sincronizar-historico`: lá o objetivo É trazer mensagem antiga). */
const IDADE_MAXIMA_MENSAGEM_AO_VIVO_MS = 2 * 60 * 1000;

export async function processarMensagemRecebida(
  workspaceId: string,
  item: unknown,
  opcoes: { permitirHistorico?: boolean } = {},
) {
  const data = item as {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean; participant?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: unknown;
      imageMessage?: { caption?: string };
      videoMessage?: { caption?: string };
      documentMessage?: { caption?: string; fileName?: string; mimetype?: string };
      stickerMessage?: unknown;
    };
    messageTimestamp?: number;
    pushName?: string;
  };

  const fromMe = data.key?.fromMe === true;
  /*
   * O conteúdo de verdade pode vir EMBRULHADO. Conversa com mensagens temporárias, foto de ver uma
   * vez, documento com legenda e mensagem editada guardam o conteúdo um ou dois níveis mais fundo.
   * O CRM lia só o nível de cima e descartava o resto em silêncio: como mensagem temporária é uma
   * configuração de cada conversa, ligada pelo CONTATO do lado dele, o sintoma era chegar de uns e
   * não chegar de outros, sem padrão nenhum. Ver `texto-da-mensagem.ts`.
   */
  const conteudo = desembrulharMensagem(data.message as Record<string, unknown> | undefined);
  const texto = extrairTextoDaMensagem(data.message as Record<string, unknown> | undefined);
  // O documento é o único tipo cujos metadados (nome e formato) só existem no evento: a busca da
  // mídia devolve o conteúdo, não o nome do arquivo.
  const documento = (conteudo?.documentMessage ?? {}) as { fileName?: string; mimetype?: string };
  const remoteJid = data.key?.remoteJid;
  // Grupo de WhatsApp: a Evolution/Baileys segue a convenção do próprio WhatsApp: `remoteJid`
  // termina em "@g.us" pra grupo (e é o JID do GRUPO, o mesmo pra qualquer participante que
  // escreva nele) contra "@s.whatsapp.net" pra conversa individual (aí sim é a outra pessoa).
  const ehGrupo = remoteJid?.endsWith("@g.us") ?? false;
  // Em grupo, `remoteJid` (acima) já identifica a thread. `waId` aqui não é telefone de ninguém,
  // é só o id numérico do grupo, usado como último recurso se a Evolution não devolver o nome dele.
  const waId = remoteJid?.split("@")[0];
  if (!texto || !waId || !data.key?.id) {
    // Log temporário pra depurar formato de payload em produção (ex.: mídia sem legenda, ou um
    // formato de evento diferente do esperado). Sem isso não dá pra ver pelos logs da Vercel por
    // que uma mensagem específica não apareceu no CRM.
    console.log("[webhook evolution] messages.upsert sem texto/waId/id reconhecível:", JSON.stringify(data).slice(0, 500));
    await registrarDescarte(workspaceId, "sem texto reconhecível", chavesDaMensagem(data.message as Record<string, unknown> | undefined));
    return;
  }

  const timestampMs = (data.messageTimestamp ?? Math.floor(Date.now() / 1000)) * 1000;
  if (!opcoes.permitirHistorico && Date.now() - timestampMs > IDADE_MAXIMA_MENSAGEM_AO_VIVO_MS) {
    await registrarDescarte(
      workspaceId,
      "mensagem antiga",
      `${Math.round((Date.now() - timestampMs) / 60_000)} minutos atrás (tratada como sincronização de histórico)`,
    );
    return;
  }

  const jaExiste = await prisma.mensagemExtra.findUnique({ where: { id: data.key.id } });
  if (jaExiste) return;

  let chaveContato: string;
  let contatoExistente: { id: string; nome: string } | null = null;
  let participantesGrupo: { nome: string; telefone: string }[] | undefined;
  let descricaoGrupo: string | null | undefined;
  let criacaoGrupo: Date | null | undefined;
  let fotoUrlExistente: string | null = null;

  if (ehGrupo) {
    // Acha a conversa do grupo pelo JID (estável). Nunca pelo nome (`nome` guarda o "assunto" do
    // grupo, que a pessoa pode trocar a qualquer momento no WhatsApp; usar ele como chave faria o
    // grupo virar uma conversa nova toda vez que o nome mudasse).
    const conversaExistente = await prisma.conversa.findFirst({
      where: { workspaceId, contato: remoteJid, ehGrupo: true },
      select: { nome: true, fotoUrl: true, participantesGrupo: true },
    });
    if (conversaExistente) {
      chaveContato = conversaExistente.nome;
      fotoUrlExistente = conversaExistente.fotoUrl;
      /*
       * GRUPO SEM LISTA DE PARTICIPANTES TENTA DE NOVO.
       *
       * A busca dos dados do grupo só acontecia quando a conversa era criada. Se ela falhasse ali
       * — ou se a Evolution devolvesse o nome sem a lista, que é o comum — o grupo ficava com zero
       * participantes PARA SEMPRE: "Grupo · 0 participantes" no cabeçalho, painel de participantes
       * vazio, e menção a alguém aparecendo como número cru, porque não havia nome pra casar.
       *
       * Agora, enquanto a lista estiver vazia, cada mensagem nova é uma chance de preenchê-la. Uma
       * chamada a mais só no grupo que ainda não tem a lista; assim que ela entra, para.
       * O NOME NÃO É MEXIDO: ele já identifica a thread, e trocá-lo partiria a conversa em duas.
       */
      const jaTemLista = Array.isArray(conversaExistente.participantesGrupo)
        ? conversaExistente.participantesGrupo.length > 0
        : false;
      if (!jaTemLista) {
        const info = await buscarInfoGrupo(workspaceId, remoteJid!);
        participantesGrupo = info?.participantes;
        descricaoGrupo = info?.descricao;
        criacaoGrupo = info?.criacao;
      }
    } else {
      const info = await buscarInfoGrupo(workspaceId, remoteJid!);
      chaveContato = info?.nome ?? waId;
      participantesGrupo = info?.participantes;
      descricaoGrupo = info?.descricao;
      criacaoGrupo = info?.criacao;
    }
  } else {
    // Quem é a thread sai do TELEFONE, não do nome de perfil: ver `resolverPessoaDoTelefone`.
    // `fromMe` manda `nomeDoPerfil: null` de propósito. Nesse evento o `pushName` é o nome do MEU
    // perfil (espelhamento do celular), e usá-lo arquivava toda mensagem que eu mandava pra um
    // número novo debaixo do nome do próprio negócio, fundindo cliente com cliente.
    const pessoa = await resolverPessoaDoTelefone({
      workspaceId,
      telefone: waId,
      nomeDoPerfil: fromMe ? null : data.pushName,
    });
    chaveContato = pessoa.nome;
    contatoExistente = pessoa.contatoExistente;
    const conversaExistente = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: chaveContato } },
      select: { fotoUrl: true },
    });
    fotoUrlExistente = conversaExistente?.fotoUrl ?? null;
  }

  // Busca a foto de perfil só na primeira vez (conversa ainda sem uma). Pedir de novo a cada
  // mensagem seria uma chamada extra à Evolution toda hora à toa, sem necessidade real.
  const fotoUrl = fotoUrlExistente ?? (await buscarFotoPerfil(workspaceId, ehGrupo ? remoteJid! : waId).catch(() => null));

  // Conexão dona desta mensagem: é o número conectado por QR Code neste workspace. Sem isso, a
  // mensagem fica sem dono e não some da tela quando esse número é desconectado.
  const integracaoNaoOficial = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  const contaCanal = contaCanalDaConexao(
    CANAL_NAO_OFICIAL,
    (integracaoNaoOficial?.metadados as { numero?: string } | null)?.numero,
  );

  if (fromMe) {
    // Mensagem mandada do próprio celular conectado (espelhamento, igual WhatsApp Web): se foi
    // o CRM que mandou pela tela de Conversas, ela já foi persistida na hora do envio (com um id
    // diferente, gerado no navegador); esse eco chegando pelo webhook não deve virar uma segunda
    // bolha. Sem um id em comum entre os dois lados pra comparar, o jeito é checar se já existe
    // uma mensagem "out" idêntica (mesmo contato/texto) nos últimos segundos.
    const jaFoiMandadaPeloCrm = await prisma.mensagemExtra.findFirst({
      where: {
        workspaceId,
        contato: chaveContato,
        tipo: "out",
        texto,
        criadoEm: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (jaFoiMandadaPeloCrm) return;
  }

  // Grupo não é uma pessoa. Não cria/casa `Contato` nem vira lead novo no funil sozinho, só a
  // thread de conversa mesmo (ver `ehGrupo` no upsert abaixo).
  const contato = ehGrupo
    ? null
    : (contatoExistente ??
      (await criarContatoPeloWhatsAppSeNaoExistir({ workspaceId, nome: chaveContato, whatsapp: waId })));

  // A foto também vai pro contato: é a mesma pessoa no funil, na lista de contatos e no painel do
  // funil. Guardada só na conversa, o funil mostrava iniciais enquanto a conversa mostrava o rosto.
  if (contato?.id && fotoUrl) {
    await prisma.contato
      .update({ where: { id: contato.id }, data: { fotoUrl } })
      .catch((erro) => console.error("[evolution] falha ao guardar a foto no contato:", erro));
  }

  await prisma.mensagemExtra.create({
    data: {
      id: data.key.id,
      workspaceId,
      contato: chaveContato,
      tipo: fromMe ? "out" : "in",
      texto,
      hora: new Date(timestampMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      criadoEm: new Date(timestampMs),
      canal: CANAL_NAO_OFICIAL,
      contaCanal,
      extras: {
        // Nome de quem escreveu DENTRO do grupo. Sem isso não dá pra distinguir os balões de cada
        // participante na tela, igual o WhatsApp de verdade mostra. Não se aplica fora de grupo (lá
        // "quem mandou" já é o próprio nome da conversa).
        ...(ehGrupo && !fromMe ? { remetenteNome: data.pushName ?? waId } : {}),
        // Áudio/imagem recebidos: conteúdo real não veio no payload (base64 desligado de
        // propósito), só esse aviso de que existe. Guarda o suficiente pra buscar sob demanda (ver
        // GET /api/integracoes/whatsapp-nao-oficial/midia): hoje isso acontece automaticamente
        // assim que a conversa é aberta, não precisa mais de clique.
        ...(conteudo?.audioMessage
          ? { midiaPendente: { remoteJid: remoteJid!, id: data.key.id, fromMe, tipo: "audio" as const } }
          : conteudo?.imageMessage
            ? { midiaPendente: { remoteJid: remoteJid!, id: data.key.id, fromMe, tipo: "imagem" as const } }
            : conteudo?.stickerMessage
              ? { midiaPendente: { remoteJid: remoteJid!, id: data.key.id, fromMe, tipo: "figurinha" as const } }
              : conteudo?.documentMessage
                ? {
                    midiaPendente: {
                      remoteJid: remoteJid!,
                      id: data.key.id,
                      fromMe,
                      tipo: "documento" as const,
                      // O nome e o tipo do arquivo só existem AQUI, no evento. A busca da mídia
                      // devolve o conteúdo, não o nome — sem guardar agora, o documento chegaria
                      // na tela como "arquivo" sem extensão.
                      nome: documento.fileName,
                      mimetype: documento.mimetype,
                    },
                  }
                : {}),
      },
    },
  });

  // Mensagem da pessoa (não eco do próprio celular) logo depois de um disparo em massa conta como
  // resposta a ele: é a métrica "Respondidas" da tela de acompanhamento.
  if (!fromMe && !ehGrupo) await registrarRespostaDeCampanha(workspaceId, chaveContato);

  await upsertConversaAoReceberMensagem({
    workspaceId,
    contaCanal,
    nome: chaveContato,
    canal: "WhatsApp",
    contato: ehGrupo ? remoteJid : waId,
    contatoId: contato?.id,
    origem: "Direto",
    // Mensagem IMPORTADA não é "não lida". Isto não olhava `permitirHistorico`, então cada
    // mensagem antiga trazida do celular somava +1 no contador: a importação terminava com
    // centenas de "não lidas" que ninguém deixou de ler, e o único jeito de limpar era abrir
    // conversa por conversa. É o mesmo motivo que já está escrito no campo, em `upsert.ts`.
    contarComoNaoLida: !fromMe && !opcoes.permitirHistorico,
    ehGrupo,
    participantesGrupo,
    fotoUrl,
    descricaoGrupo,
    criacaoGrupo,
  });

  /*
   * "Chegou pelo webhook, e foi gravada NESTA conversa." Sem isto, "a mensagem não chegou" e "a
   * mensagem chegou e foi parar numa conversa com outro nome" eram indistinguíveis na tela — e a
   * segunda é comum, porque a conversa é identificada por nome.
   *
   * SÓ PRA MENSAGEM AO VIVO, e isso é correção de um erro meu. Sem o `!permitirHistorico`, a
   * importação de histórico gravava este registro a cada mensagem trazida — e cada gravação
   * reescreve a coluna `metadados` inteira. Com 200 mensagens por conversa e dezenas de conversas,
   * eram milhares de escritas na mesma linha, competindo com a gravação do próprio progresso da
   * importação. Além de lento, não media nada do que esta linha existe pra medir: a pergunta aqui
   * é "a Evolution está entregando mensagem nova?", e importação não responde isso.
   */
  if (!opcoes.permitirHistorico) {
    await registrarMensagemGravada(workspaceId, chaveContato, ehGrupo).catch(() => {});
  }

  // O negócio no funil vem DEPOIS da conversa, e essa ordem importa.
  //
  // Era o contrário, e qualquer falha entre os dois (a gravação da mensagem, a marcação de resposta
  // de campanha) deixava o negócio criado e a conversa não. Na tela isso vira "conversei com a
  // pessoa e a conversa não chegou", indistinguível de mensagem perdida. A conversa é o registro
  // principal; o negócio é derivado dela.
  //
  // Só entra como lead novo no funil quando ALGUÉM DE FORA escreveu primeiro pra um contato que
  // ainda não existia: mensagem que a própria pessoa manda do celular pra alguém (ex.: um
  // contato pessoal) não deve virar negócio no funil sozinha.
  if (!ehGrupo && !fromMe && !contatoExistente) {
    await entrarNaPrimeiraEtapaComoNovoLead({
      workspaceId,
      contatoNome: chaveContato,
      ehGrupo,
      origem: "WhatsApp",
      contaCanal,
    });
  } else if (!ehGrupo && !fromMe) {
    // Contato que já tinha card: a ETAPA não se mexe, mas o card sobe pro topo da coluna. Quem
    // acabou de falar precisa estar visível sem rolar a coluna inteira.
    await subirCardParaOTopo(workspaceId, chaveContato);
  }


  // `fromMe` é mensagem que saiu do próprio celular conectado (espelhada aqui). Não é uma pessoa
  // falando com você, e disparar automação nela faria o CRM responder a si mesmo. Grupo também
  // fica de fora: automação num grupo escreveria pra todo mundo de uma vez.
  /*
   * AUTOMAÇÃO NÃO DISPARA EM MENSAGEM IMPORTADA.
   *
   * Automação é reação a alguém falando com você AGORA. Numa importação de histórico ela estaria
   * reagindo a mensagem de semanas atrás — e reagir, aqui, quer dizer MANDAR MENSAGEM pro cliente.
   * Reimportar o histórico dispararia uma enxurrada de respostas automáticas para conversas
   * encerradas há muito tempo, do lado de fora, onde não tem como desfazer.
   *
   * Até aqui isso não tinha acontecido só porque a importação roda uma vez e mensagem já gravada é
   * ignorada antes de chegar aqui. Passa a ser uma regra explícita porque agora a importação pode
   * ser rodada de novo, de propósito.
   */
  if (!fromMe && !ehGrupo && !opcoes.permitirHistorico) {
    await dispararAutomacoesDeMensagemRecebida({
      workspaceId,
      contatoNome: chaveContato,
      canal: "WhatsApp",
      textoRecebido: texto,
    }).catch((erro) => console.error("[webhook evolution] falha ao disparar automações:", erro));
  }
}
