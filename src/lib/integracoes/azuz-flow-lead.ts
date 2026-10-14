import { prisma } from "@/lib/prisma";
import { aoCriarContato } from "@/lib/automacoes/gatilhos-crm";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";
import { encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { entrarNaPrimeiraEtapaComoNovoLead, subirCardParaOTopo } from "@/lib/funis/upsert";
import { CANAL_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";
import { contaConectada } from "@/lib/integracoes/whatsapp-oficial";
import { anotarNaLinhaDoTempo } from "@/lib/integracoes/instagram-eventos";
import { slugId } from "@/lib/ids";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import { dataIsoEmBrasilia, horaEmBrasilia } from "@/lib/agenda/fuso";
import type { LeadDoFlow, ReuniaoDoFlow } from "./azuz-flow-payload";

export const ORIGEM_FLOW = "azuz_flow";

export type ResultadoDoLead = {
  ok: true;
  criado: boolean;
  duplicado: boolean;
  contatoId: string | null;
  conversaId: string | null;
  etapa: { funil: string; etapa: string } | null;
  whatsappOficialConectado: boolean;
  avisos: string[];
};

/**
 * Tudo que fala com o banco ou com a Meta, num objeto só.
 *
 * Existe pra o teste poder exercitar a ORDEM e as decisões sem banco nenhum — e a ordem é o que
 * mais importa aqui: a automação que manda o modelo só funciona se a conversa já existir quando
 * ela dispara, e isso é invisível em qualquer teste que mocke no nível errado.
 */
export type DependenciasDoFlow = {
  acharEntregaAnterior: (chave: string) => Promise<ResultadoDoLead | null>;
  gravarEntrega: (params: {
    chave: string;
    contatoId: string | null;
    conversaId: string | null;
    resultado: ResultadoDoLead;
  }) => Promise<void>;

  acharContatoPorTelefone: (telefone: string) => Promise<{ id: string; nome: string } | null>;
  acharContatoPorEmail: (email: string) => Promise<{ id: string; nome: string } | null>;
  nomeOcupado: (nome: string) => Promise<boolean>;
  lerContato: (nome: string) => Promise<Record<string, unknown> | null>;

  criarContato: (dados: Record<string, unknown> & { nome: string }) => Promise<{ id: string; nome: string }>;
  atualizarContato: (nome: string, dados: Record<string, unknown>) => Promise<void>;

  anotarNaLinhaDoTempo: (params: { contatoNome: string; descricao: string }) => Promise<void>;

  /** Idempotente por definição: repetir a mesma entrega não cria um segundo compromisso. */
  garantirCompromisso: (params: {
    chaveDaEntrega: string;
    contatoId: string;
    contatoNome: string;
    formularioNome: string;
    reuniao: ReuniaoDoFlow;
  }) => Promise<void>;

  contaOficial: () => Promise<{ phoneNumberId: string } | null>;
  garantirConversa: (params: {
    nome: string;
    telefone: string;
    contatoId: string;
    contaCanal: string | null;
  }) => Promise<{ id: string } | null>;

  temCardNoFunil: (contatoNome: string) => Promise<boolean>;
  entrarNoFunil: (params: {
    contatoNome: string;
    contaCanal: string | null;
  }) => Promise<{ funil: string; etapa: string } | null>;
  subirCard: (contatoNome: string) => Promise<void>;

  avisarContatoCriado: (params: { contatoNome: string; contatoId: string }) => void;
  dispararAutomacoes: (params: { contatoNome: string; chaveEvento: string }) => Promise<void>;
};

/**
 * O banco recusou por chave repetida (`P2002`).
 *
 * Isto não é um caso raro de laboratório: um formulário que publica em dois canais entrega dois
 * leads no mesmo segundo, e o id do contato é derivado do NOME (`workspaceId-slug(nome)`). Os dois
 * pedidos perguntam "esse nome está livre?" antes de qualquer um gravar, os dois ouvem "está", e o
 * segundo `create` bate na chave primária.
 *
 * Conferir o código em vez da mensagem porque a mensagem vem do MySQL, em inglês, e muda de versão
 * pra versão: "Unique constraint failed on the constraint: PRIMARY" é texto, não contrato.
 */
export function ehChaveDuplicada(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as { code?: unknown }).code === "P2002";
}

/** Etiqueta que as automações usam pra filtrar de qual formulário o lead veio. É o que permite um
 *  fluxo por formulário sem inventar um tipo de gatilho novo pra cada um. */
export function etiquetaDoFormulario(formularioNome: string): string {
  return `Flow: ${formularioNome}`;
}

function etiquetasAtuais(contato: Record<string, unknown> | null): string[] {
  const valor = contato?.etiquetas;
  return Array.isArray(valor) ? valor.filter((e): e is string => typeof e === "string") : [];
}

/**
 * Entrega um lead do Flow no CRM.
 *
 * A ORDEM É O CONTRATO, não uma preferência de estilo: contato, conversa e card primeiro, e só
 * então a automação. `enviarModeloOficial` só manda mensagem se já existe uma `Conversa` do
 * contato — disparar antes significa uma automação que falha em silêncio dizendo "conversa não
 * encontrada", que é o defeito que esta função existe pra não ter.
 */
export async function receberLeadDoFlow(params: {
  workspaceId: string;
  lead: LeadDoFlow;
  deps: DependenciasDoFlow;
}): Promise<ResultadoDoLead> {
  const { lead, deps } = params;

  // 1. Idempotência. O Flow repete quando a rede falha; repetir não pode criar um segundo lead.
  const anterior = await deps.acharEntregaAnterior(lead.respostaId);
  if (anterior) return { ...anterior, duplicado: true };

  const avisos = [...lead.avisos];

  /*
   * ACHAR, DECIDIR O NOME E GRAVAR — tudo junto, porque tudo isso pode precisar ser refeito.
   *
   * Entre a pergunta "esse nome está livre?" e o `create` existe uma janela, e ela não é teórica:
   * um formulário publicado em dois canais entrega dois leads no mesmo segundo. Os dois perguntam,
   * os dois ouvem "está livre", e o segundo `create` bate na chave primária (o id do contato sai do
   * nome). Antes isso virava 500, e só se resolvia porque o Flow repetia a entrega um minuto
   * depois.
   *
   * A correção não é travar o banco: é REFAZER a decisão uma vez. Na segunda passada o contato do
   * concorrente já existe, e aí as mesmas regras de sempre resolvem sozinhas — mesmo telefone cai
   * no caminho de completar, telefone diferente encontra o nome ocupado e usa o sufixo. Nenhuma
   * regra nova, só a chance de olhar de novo.
   */
  async function resolverEGravarContato(tentativa: number): Promise<{
    contatoId: string;
    nomeDoContato: string;
    criado: boolean;
  }> {
    // 2. Achar a pessoa: telefone primeiro (é a chave mais confiável), e-mail depois.
    let existente: { id: string; nome: string } | null = null;
    if (lead.whatsapp) existente = await deps.acharContatoPorTelefone(lead.whatsapp);
    if (!existente && lead.email) existente = await deps.acharContatoPorEmail(lead.email);

    /*
     * O NOME, quando o contato é novo.
     *
     * Duas pessoas diferentes com o mesmo nome não podem virar uma só: o nome é a chave do contato,
     * e fundir é irreversível — o histórico de uma passa a ser o da outra. Então, nome ocupado por
     * OUTRA pessoa, acrescenta o sufixo do formulário. Feio, e muito melhor do que perder um
     * cliente dentro do cadastro de outro.
     */
    let nomeDoContato = existente?.nome ?? lead.nomeDoContato;
    if (!existente && (await deps.nomeOcupado(nomeDoContato))) {
      nomeDoContato = `${lead.nomeDoContato} (${lead.formularioNome})`.slice(0, 120);
      // Ainda ocupado (o mesmo formulário já trouxe um homônimo): desempata pelo id da entrega, que
      // é único por definição.
      if (await deps.nomeOcupado(nomeDoContato)) {
        nomeDoContato = `${lead.nomeDoContato} (${lead.respostaId.slice(-6)})`.slice(0, 120);
      }
      avisos.push(
        `Já havia outro contato chamado "${lead.nomeDoContato}", então este entrou como "${nomeDoContato}".`,
      );
    }

    const contatoAtual = existente ? await deps.lerContato(nomeDoContato) : null;
    const etiquetas = new Set(etiquetasAtuais(contatoAtual));
    etiquetas.add(etiquetaDoFormulario(lead.formularioNome));
    if (lead.consentimentoWhatsApp) etiquetas.add("WhatsApp: consentiu");

    const consentimento = decidirConsentimento({
      novo: !existente,
      jaGravado: contatoAtual?.consentimentoWhatsApp as boolean | null | undefined,
      aceitou: lead.consentimentoWhatsApp,
      texto: lead.consentimentoTexto,
      em: lead.consentimentoEm ?? lead.recebidaEm ?? new Date(),
      origem: `azuz-flow:${lead.formularioNome}`,
    });

    // 3. Criar ou completar. Em contato existente só entra o que está VAZIO: o CRM é a fonte da
    //    verdade sobre quem já é cliente, e um formulário preenchido às pressas não pode
    //    sobrescrever o telefone que a equipe confirmou por telefone.
    if (existente) {
      const completar: Record<string, unknown> = { etiquetas: [...etiquetas], ...consentimento };
      for (const [campo, valor] of camposDoLead(lead)) {
        if (valor && !contatoAtual?.[campo]) completar[campo] = valor;
      }
      await deps.atualizarContato(nomeDoContato, completar);
      return { contatoId: existente.id, nomeDoContato, criado: false };
    }

    try {
      const novo = await deps.criarContato({
        nome: nomeDoContato,
        origem: `Formulário: ${lead.formularioNome}`,
        criadoVia: "azuz-flow",
        etapa: "Novo",
        etiquetas: [...etiquetas],
        ...Object.fromEntries(camposDoLead(lead).filter(([, valor]) => Boolean(valor))),
        ...consentimento,
      });
      return { contatoId: novo.id, nomeDoContato, criado: true };
    } catch (erro) {
      // Outro pedido criou este nome entre a conferência e agora. UMA repetição: na segunda passada
      // o concorrente já existe, e as regras normais decidem. Insistir além disso esconderia um
      // defeito de verdade atrás de um laço.
      if (ehChaveDuplicada(erro) && tentativa === 0) {
        // O aviso de homônimo da passada anterior não vale mais: a decisão vai ser refeita do zero.
        avisos.length = lead.avisos.length;
        return resolverEGravarContato(1);
      }
      throw erro;
    }
  }

  const { contatoId, nomeDoContato, criado } = await resolverEGravarContato(0);

  // 4. Linha do tempo: o que a pessoa respondeu, por extenso. É o que o vendedor lê antes de falar
  //    com ela, e é a única cópia dessas respostas dentro do CRM.
  const corpo = lead.respostas.map((r) => `${r.pergunta}: ${r.resposta}`).join(" · ");
  await deps
    .anotarNaLinhaDoTempo({
      contatoNome: nomeDoContato,
      descricao: `Respondeu o formulário ${lead.formularioNome}${corpo ? ` — ${corpo}` : ""}`,
    })
    .catch(() => {});

  /*
   * 5. A REUNIÃO, como dado na Agenda.
   *
   * Antes disso ela só existia como frase na linha do tempo, que ninguém consegue consultar: não
   * aparece na Agenda, não vira lembrete e não dá pra pôr num modelo. Como `Compromisso` ela é um
   * registro com dia e hora.
   *
   * Vem ANTES das automações de propósito, porque as variáveis `reuniao.*` são lidas do banco na
   * hora do envio. Gravar depois mandaria "sua reunião é dia " — a automação já teria rodado.
   *
   * Falhar aqui NÃO derruba o lead: o nome e o WhatsApp da pessoa valem mais do que o compromisso,
   * e devolver erro faria o Flow repetir uma entrega que, no essencial, deu certo. Fica o aviso na
   * resposta e o registro no log (só ids, nunca o conteúdo do lead).
   */
  if (lead.reuniao) {
    try {
      await deps.garantirCompromisso({
        chaveDaEntrega: lead.respostaId,
        contatoId,
        contatoNome: nomeDoContato,
        formularioNome: lead.formularioNome,
        reuniao: lead.reuniao,
      });
    } catch (erro) {
      avisos.push("A reunião não pôde ser gravada na Agenda; o lead entrou sem compromisso.");
      console.error("[azuz-flow] compromisso não gravado:", { contatoId, erro });
    }
  }

  // 6. Conversa. Ela nasce VAZIA e com zero não lidas: existe pra a automação ter por onde falar,
  //    não porque alguém escreveu. Contar como não lida poria um badge vermelho numa conversa em
  //    que ninguém disse nada.
  const conta = await deps.contaOficial();
  const whatsappOficialConectado = Boolean(conta);
  const contaCanal = conta ? contaCanalDaConexao(CANAL_OFICIAL, conta.phoneNumberId) : null;

  let conversaId: string | null = null;
  if (lead.whatsapp && conta) {
    const conversa = await deps.garantirConversa({
      nome: nomeDoContato,
      telefone: lead.whatsapp,
      contatoId,
      contaCanal,
    });
    conversaId = conversa?.id ?? null;
  } else if (lead.whatsapp && !conta) {
    avisos.push("O WhatsApp oficial não está conectado, então o lead entrou sem conversa.");
  }

  // 7. Funil. Quem já está no funil NÃO muda de etapa: o vendedor pôs a pessoa onde ela está, e um
  //    formulário novo não é motivo pra jogá-la de volta pro começo. Só sobe pro topo.
  let etapa: { funil: string; etapa: string } | null = null;
  if (await deps.temCardNoFunil(nomeDoContato)) {
    await deps.subirCard(nomeDoContato);
  } else {
    etapa = await deps.entrarNoFunil({ contatoNome: nomeDoContato, contaCanal });
  }

  const resultado: ResultadoDoLead = {
    ok: true,
    criado,
    duplicado: false,
    contatoId,
    conversaId,
    etapa,
    whatsappOficialConectado,
    avisos,
  };

  /*
   * 8. Marca a entrega como feita ANTES de disparar automação: se o processo morrer entre uma coisa
   *    e outra, a repetição do Flow não cria tudo de novo. Automação perdida é um lead sem
   *    mensagem; entrega não registrada é um lead duplicado, com duas mensagens.
   *
   *    DUAS CHAMADAS SIMULTÂNEAS COM A MESMA ENTREGA chegam aqui juntas: as duas passaram pela
   *    conferência de idempotência antes de qualquer uma gravar. Uma vence, a outra bate na chave
   *    única — e isso é a resposta, não um erro. Ela devolve o resultado que a vencedora guardou,
   *    como qualquer repetição. Devolver 500 faria o Flow repetir uma entrega que já deu certo.
   */
  try {
    await deps.gravarEntrega({ chave: lead.respostaId, contatoId, conversaId, resultado });
  } catch (erro) {
    if (!ehChaveDuplicada(erro)) throw erro;
    const guardado = await deps.acharEntregaAnterior(lead.respostaId);
    // Sem o registro da vencedora não há o que devolver: aí o erro é de verdade e sobe.
    if (!guardado) throw erro;
    return { ...guardado, duplicado: true };
  }

  // 9. Por último, com tudo gravado. Falha aqui não derruba a resposta: o lead já está no CRM, e
  //    devolver erro faria o Flow repetir uma entrega que deu certo.
  if (criado) deps.avisarContatoCriado({ contatoNome: nomeDoContato, contatoId });
  await deps
    .dispararAutomacoes({ contatoNome: nomeDoContato, chaveEvento: `flow:${lead.respostaId}` })
    .catch((erro) => console.error("[azuz-flow] automações falharam depois do lead gravado:", erro));

  return resultado;
}

/** Os campos do lead que viram colunas do contato. Fora daqui nada é escrito. */
function camposDoLead(lead: LeadDoFlow): [string, string | null][] {
  return [
    ["email", lead.email],
    ["whatsapp", lead.whatsapp],
    ["sobrenome", lead.sobrenome],
    ["empresa", lead.empresa],
    ["cargo", lead.cargo],
    ["cidade", lead.cidade],
    ["estado", lead.estado],
    ["pais", lead.pais],
    ["endereco", lead.endereco],
  ];
}

/**
 * O que gravar de consentimento.
 *
 * `aceitou: false` NÃO revoga um `true` anterior, e essa é a regra que mais importa: a ausência de
 * uma caixa marcada num formulário qualquer não é a pessoa dizendo "pare de me mandar mensagem".
 * Ela pode ter consentido noutro formulário, ou por escrito. Revogação é um gesto explícito e não
 * passa por aqui.
 */
export function decidirConsentimento(params: {
  novo: boolean;
  jaGravado: boolean | null | undefined;
  aceitou: boolean;
  texto: string | null;
  em: Date;
  origem: string;
}): Record<string, unknown> {
  const gravar = {
    consentimentoWhatsApp: true,
    consentimentoWhatsAppEm: params.em,
    consentimentoWhatsAppTexto: params.texto,
    consentimentoWhatsAppOrigem: params.origem,
  };

  if (params.aceitou) return gravar;
  // Recusou agora, mas já havia consentido antes: nada muda.
  if (params.jaGravado === true) return {};
  return { ...gravar, consentimentoWhatsApp: false };
}

/** As dependências de verdade, ligadas no banco e na Meta. */
export function dependenciasReais(workspaceId: string): DependenciasDoFlow {
  return {
    async acharEntregaAnterior(chave) {
      const linha = await prisma.leadRecebido.findUnique({
        where: {
          workspaceId_origem_chaveExterna: { workspaceId, origem: ORIGEM_FLOW, chaveExterna: chave },
        },
        select: { resultado: true },
      });
      return (linha?.resultado as ResultadoDoLead | undefined) ?? null;
    },
    async gravarEntrega({ chave, contatoId, conversaId, resultado }) {
      await prisma.leadRecebido.create({
        data: {
          workspaceId,
          origem: ORIGEM_FLOW,
          chaveExterna: chave,
          contatoId,
          conversaId,
          resultado: resultado as unknown as object,
        },
      });
    },

    async acharContatoPorTelefone(telefone) {
      const achado = await encontrarContatoPorTelefone(workspaceId, telefone);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async acharContatoPorEmail(email) {
      // `email` é gravado como veio; a comparação é em memória porque o conjunto por workspace é
      // pequeno e MySQL com collation sensível a caixa deixaria passar o mesmo e-mail com outra
      // grafia — que é justamente a duplicata que se quer evitar.
      const candidatos = await prisma.contato.findMany({
        where: { workspaceId, email: { not: null } },
        select: { id: true, nome: true, email: true },
      });
      const alvo = email.toLowerCase();
      const achado = candidatos.find((c) => c.email?.toLowerCase() === alvo);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async nomeOcupado(nome) {
      const achado = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return Boolean(achado);
    },
    async lerContato(nome) {
      return (await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
      })) as Record<string, unknown> | null;
    },

    async criarContato(dados) {
      const { nome, ...resto } = dados;
      const criado = await prisma.contato.create({
        data: {
          id: `${workspaceId}-${slugId(nome)}`,
          workspaceId,
          initials: iniciaisDe(nome),
          nome,
          origem: (resto.origem as string) ?? "Formulário",
          etapa: (resto.etapa as string) ?? "Novo",
          responsavel: "-",
          ultima: "Agora",
          valor: "-",
          ...(resto as object),
        },
      });
      return { id: criado.id, nome: criado.nome };
    },
    async atualizarContato(nome, dados) {
      await prisma.contato.update({ where: { workspaceId_nome: { workspaceId, nome } }, data: dados });
    },

    async anotarNaLinhaDoTempo({ contatoNome, descricao }) {
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal: "CRM",
        tipo: "formulario_respondido",
        descricao,
      });
    },

    /*
     * O ID DO COMPROMISSO É DERIVADO DA ENTREGA, e é isso que dá a idempotência.
     *
     * `Compromisso.id` é chave primária. Com um id que sai do `respostaId`, a repetição do Flow e
     * duas chamadas simultâneas com a mesma entrega colidem no banco: o segundo `create` recebe
     * `P2002` e a gente trata isso como "já está gravado", porque é o que é. Não precisou de índice
     * novo nem de transação — e a regra do projeto é mudança de banco só aditiva.
     *
     * O `slugId` entra porque o `respostaId` vem de fora e pode ter caractere que não se quer numa
     * chave primária. O corte em 180 respeita o varchar(191) que o Prisma usa pra `String @id`.
     */
    async garantirCompromisso({ chaveDaEntrega, contatoId, contatoNome, formularioNome, reuniao }) {
      const id = `flow-reuniao-${workspaceId}-${slugId(chaveDaEntrega)}`.slice(0, 180);
      try {
        await prisma.compromisso.create({
          data: {
            id,
            workspaceId,
            contato: contatoNome,
            contatoId,
            responsavel: "-",
            // Dia e hora no fuso de Brasília: `Compromisso.dataIso`/`hora` são hora LOCAL (é o que
            // o usuário digita na Agenda), e o Flow manda o instante em UTC.
            dataIso: dataIsoEmBrasilia(reuniao.inicio),
            hora: horaEmBrasilia(reuniao.inicio),
            horaFim: reuniao.fim ? horaEmBrasilia(reuniao.fim) : null,
            tipo: "Reunião",
            descricao: `Agendada no formulário ${formularioNome}`,
            local: reuniao.link,
            status: "agendado",
            origem: "azuz-flow",
          },
        });
      } catch (erro) {
        // Já gravado por uma entrega repetida ou pela chamada concorrente: é o resultado esperado.
        if (!ehChaveDuplicada(erro)) throw erro;
      }
    },

    async contaOficial() {
      const conta = await contaConectada(workspaceId);
      return conta ? { phoneNumberId: conta.phoneNumberId } : null;
    },
    async garantirConversa({ nome, telefone, contatoId, contaCanal }) {
      await upsertConversaAoReceberMensagem({
        workspaceId,
        nome,
        canal: "WhatsApp",
        contato: normalizarTelefoneParaComparacao(telefone),
        origem: "Formulário",
        // `contarComoNaoLida: false` faz o trabalho de duas coisas aqui: a conversa nova nasce com
        // zero não lidas (ninguém escreveu), e uma conversa que já existia não é tocada — não ganha
        // badge nem é desarquivada por um formulário preenchido.
        contatoId,
        contarComoNaoLida: false,
        contaCanal,
      });
      // `upsertConversaAoReceberMensagem` não devolve a linha (ela é chamada por webhook, que não
      // precisa do id). Lemos de volta porque a resposta ao Flow carrega o `conversaId`.
      const conversa = await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return conversa ? { id: conversa.id } : null;
    },

    async temCardNoFunil(contatoNome) {
      const card = await prisma.negocioCard.findFirst({
        where: { workspaceId, nome: contatoNome },
        select: { id: true },
      });
      return Boolean(card);
    },
    async entrarNoFunil({ contatoNome, contaCanal }) {
      const card = await entrarNaPrimeiraEtapaComoNovoLead({
        workspaceId,
        contatoNome,
        origem: "Formulário",
        contaCanal,
      });
      if (!card) return null;
      const etapa = await prisma.funilEtapa.findUnique({
        where: { id: card.etapaId },
        select: { titulo: true, funil: { select: { nome: true } } },
      });
      return etapa ? { funil: etapa.funil.nome, etapa: etapa.titulo } : null;
    },
    async subirCard(contatoNome) {
      await subirCardParaOTopo(workspaceId, contatoNome);
    },

    avisarContatoCriado({ contatoNome, contatoId }) {
      aoCriarContato({ workspaceId, contatoNome, contatoId });
    },
    async dispararAutomacoes({ contatoNome, chaveEvento }) {
      await dispararAutomacoesDoCrm({
        workspaceId,
        contatoNome,
        tipoGatilho: "formulario_preenchido",
        chaveEvento,
      });
    },
  };
}

function iniciaisDe(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}
