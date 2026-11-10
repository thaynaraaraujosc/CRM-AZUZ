/**
 * Validações mecânicas do grafo: o que dá pra checar só olhando nós/arestas,
 * sem rodar o fluxo de verdade. Usado antes de publicar (`publicarFluxo`) e,
 * depois, pra destacar problema em cada nó no canvas.
 */

import {
  campoDeCondicaoExiste,
  ehCampoDeInstagram,
  fontePedeTexto,
  operadoresDoCampo,
  pedeValor,
  pedeVariosValores,
  rotuloDoCampo,
} from "./campos-condicao";
import { numeroDeTexto } from "./avaliacao";
import { BLOCOS_DISPONIVEIS } from "./blocos";
import type {
  CondicaoRamosData,
  AgendarConsultaData,
  AguardarData,
  AtualizarStatusData,
  AtualizarValorData,
  CancelarAgendamentoData,
  CriarNegocioData,
  CriarTarefaData,
  DistribuirDisponibilidadeData,
  EncaminharEquipeData,
  EncaminharHumanoData,
  EnviarFormularioData,
  EtiquetaEventoData,
  FlowEdge,
  FlowNode,
  FluxoAutomacao,
  GatilhoEtapaData,
  GrupoCondicoes,
  RegraCondicao,
  MensagemBotoesData,
  MensagemContatoData,
  MensagemEmailData,
  MensagemLocalizacaoData,
  MensagemMidiaData,
  MensagemModeloWhatsappData,
  MensagemTextoData,
  ProblemaValidacao,
  TarefaEventoData,
} from "./types";

let contador = 0;
function proximoIdProblema(): string {
  contador += 1;
  return `problema-${Date.now()}-${contador}`;
}

function ehTextoVazio(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

const TIPOS_MENSAGEM_TEXTO = new Set(["mensagem_texto", "mensagem_email", "notificacao_interna"]);
const TIPOS_MENSAGEM_OPCOES = new Set(["mensagem_botoes", "mensagem_lista"]);
const TIPOS_MENSAGEM_MIDIA = new Set(["mensagem_imagem", "mensagem_video", "mensagem_audio", "mensagem_documento"]);

/**
 * O QUE A VALIDAÇÃO NÃO TEM COMO SABER SOZINHA.
 *
 * Este arquivo é puro: ele lê o desenho do fluxo e mais nada. Mas há pendência que só existe
 * olhando pra FORA do desenho — "esta condição pergunta pelo Instagram e o Instagram não está
 * conectado" — e sem ela o fluxo é publicado com um caminho que nunca vai ser escolhido.
 *
 * Ausente quer dizer "não se sabe", e aí a pendência não aparece: avisar que a conta está
 * desligada sem ter checado seria pior do que não avisar.
 */
export type ContextoDeValidacao = {
  instagramConectado?: boolean;
};

/**
 * O NOME DO BLOCO COMO A PESSOA O VÊ NA TELA.
 *
 * As pendências diziam `instagram_story_respondido` e `comentario_instagram` — o identificador do
 * código, que não aparece em lugar nenhum da interface. "O gatilho instagram_story_respondido não
 * leva a passo nenhum" manda procurar no quadro uma coisa que, no quadro, se chama "Resposta nos
 * stories". É o mesmo defeito que a frase da condição já tinha tido, aqui em cinquenta e cinco
 * mensagens de uma vez.
 *
 * A ordem é: o nome que a pessoa deu ao bloco, senão o nome do bloco na biblioteca, e só em último
 * caso o identificador — que sobra pro bloco de um tipo que a biblioteca não conhece mais, onde
 * dizer o identificador é melhor que não dizer nada.
 */
function nomeDoBloco(no: { titulo?: string; type: string } | undefined, seNaoHouver = ""): string {
  if (!no) return seNaoHouver;
  if (no.titulo?.trim()) return no.titulo;
  return BLOCOS_DISPONIVEIS.find((b) => b.tipo === no.type)?.label ?? no.type;
}

export function validarFluxo(fluxo: FluxoAutomacao, contexto: ContextoDeValidacao = {}): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const { nodes, edges } = fluxo;
  const nodesPorId = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

  const saidasPorNo = new Map<string, FlowEdge[]>();
  const entradasPorNo = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!saidasPorNo.has(e.source)) saidasPorNo.set(e.source, []);
    saidasPorNo.get(e.source)!.push(e);
    if (!entradasPorNo.has(e.target)) entradasPorNo.set(e.target, []);
    entradasPorNo.get(e.target)!.push(e);
  });

  /**
   * Robô cujo gatilho mora na ETAPA do funil, não num bloco dentro do fluxo.
   *
   * É o caminho normal de quem cria a automação por "Automatizar funil": a etapa é a dona do
   * gatilho, e o canvas só descreve o que o robô faz. O motor já trata esse caso desde sempre
   * (`primeiroNoDepoisDoGatilho` em `src/lib/automacoes/iniciar.ts`: sem bloco de gatilho, começa
   * pelo único nó em que ninguém entra). A validação é que não sabia disso e exigia um bloco de
   * gatilho no canvas, então esses robôs nunca conseguiam ser publicados.
   */
  const gatilhoNaEtapa = Boolean(fluxo.funilId && fluxo.etapaId);

  const raizes = nodes.filter((n) => (entradasPorNo.get(n.id)?.length ?? 0) === 0);

  // 1. Precisa de pelo menos um nó de gatilho: só quando não é a etapa que dispara.
  const gatilhos = nodes.filter((n) => n.category === "gatilho");
  if (gatilhos.length === 0 && !gatilhoNaEtapa) {
    problemas.push({
      id: proximoIdProblema(),
      severidade: "erro",
      mensagem: "O fluxo não tem nenhum gatilho. Nada vai disparar essa automação.",
    });
  }

  // 2. Raiz (sem entrada) que não é gatilho. Bloco solto no começo do fluxo.
  //
  // Com o gatilho na etapa, UMA raiz é o começo legítimo do robô. Mais de uma é um problema de
  // verdade, e do tipo que só aparece na hora de rodar: o motor não escolhe entre duas entradas,
  // ele desiste e o robô não roda, sem dizer nada.
  if (gatilhoNaEtapa && raizes.length > 1) {
    raizes.forEach((n) => {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `O robô tem ${raizes.length} pontos de partida, e "${nomeDoBloco(n)}" é um deles. Ligue os blocos num começo só, senão ele não roda.`,
        nodeId: n.id,
      });
    });
  } else if (!gatilhoNaEtapa) {
    nodes.forEach((n) => {
      const temEntrada = (entradasPorNo.get(n.id)?.length ?? 0) > 0;
      if (!temEntrada && n.category !== "gatilho") {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `Bloco "${nomeDoBloco(n)}" não está conectado a nada antes dele.`,
          nodeId: n.id,
        });
      }
    });
  }

  // 3. Caminho pendurado: sem saída e não é um bloco de fim.
  nodes.forEach((n) => {
    const temSaida = (saidasPorNo.get(n.id)?.length ?? 0) > 0;
    if (temSaida || n.category === "fim") return;
    /*
     * GATILHO SEM CAMINHO NÃO "TERMINA O FLUXO": ELE NÃO COMEÇA NADA.
     *
     * A mensagem genérica aparecia nos gatilhos marcados e ainda não ligados — "o bloco
     * instagram_story_respondido termina o fluxo sem passar por Encerrar fluxo" — e dizia uma
     * coisa que não é verdade sobre eles: gatilho não termina, gatilho começa. O que está errado
     * ali é outra coisa, e tem outro tamanho: quem responder o story vai disparar uma automação
     * que não faz nada.
     *
     * E é AVISO, não erro. Marcar três gatilhos e ligar um de cada vez é como se monta uma
     * automação; travar a publicação no meio disso seria cobrar que o robô nascesse pronto.
     */
    if (n.category === "gatilho") {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        /* A frase diz O QUE FAZER, e não só o que está errado. O cartão dos gatilhos lista um por
           linha, e o que não tem caminho tem um "+" do lado do nome: é dali que se diz o que
           acontece quando ele dispara. Sem essa segunda metade, a pendência manda procurar a
           solução no quadro inteiro. */
        mensagem: `O gatilho "${nomeDoBloco(n)}" não leva a passo nenhum: quem disparar por ele não vai receber nada. Clique no "+" ao lado do nome dele, no cartão dos gatilhos, pra dizer o que ele faz.`,
        nodeId: n.id,
      });
      return;
    }
    problemas.push({
      id: proximoIdProblema(),
      severidade: "erro",
      mensagem: `Bloco "${nomeDoBloco(n)}" termina o fluxo sem passar por um bloco de "Encerrar fluxo".`,
      nodeId: n.id,
    });
  });

  // 4. Botões/lista: precisa ter pelo menos uma opção, cada opção precisa de rótulo preenchido, e
  // toda opção precisa ter uma aresta de saída com esse handle (nenhum "caminho sem identificação").
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_OPCOES.has(n.type)) return;
    const data = n.data as MensagemBotoesData;
    const saidas = saidasPorNo.get(n.id) ?? [];
    const opcoes = data.opcoes ?? [];
    if (opcoes.length === 0) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" é uma pergunta sem nenhuma opção de resposta.`,
        nodeId: n.id,
      });
    }
    // O que o canal ENTREGA de verdade, não o que o editor desenha. Aviso, não erro: o envio não
    // falha: ele cai num formato menos bonito, e é isso que a pessoa precisa saber antes.
    if (opcoes.length > 3 && opcoes.length <= 10) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}" tem ${opcoes.length} opções: o WhatsApp oficial só entrega 3 como botões, então vai como lista.`,
        nodeId: n.id,
      });
    } else if (opcoes.length > 10) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}" tem ${opcoes.length} opções: acima de 10 nenhum canal tem formato interativo, e a pergunta sai como menu numerado.`,
        nodeId: n.id,
      });
    }
    const longas = opcoes.filter((o) => (o.rotulo ?? "").trim().length > 20);
    if (longas.length) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}": ${longas.length === 1 ? "uma opção passa" : `${longas.length} opções passam`} de 20 caracteres e ${longas.length === 1 ? "vai" : "vão"} aparecer cortada${longas.length === 1 ? "" : "s"} no botão.`,
        nodeId: n.id,
      });
    }

    // A saída "Não respondeu" existe no desenho, mas a pergunta espera sem prazo: o ramo fica
    // pendurado pra sempre e parece que a automação simplesmente parou. Só avisa quando de fato
    // não há prazo: ligar um caminho aqui no editor já grava um padrão (`garantirPrazoDeEspera`),
    // e repetir o aviso com o prazo gravado seria apontar um problema que não existe mais.
    if (!data.esperaMinutos && saidas.some((e) => e.sourceHandle === "nao_respondeu")) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `O caminho "Não respondeu" do bloco "${nomeDoBloco(n)}" nunca é seguido: a pergunta espera sem prazo. Pra ter desistência por tempo, use o bloco "Aguardar" com tempo máximo depois da pergunta.`,
        nodeId: n.id,
      });
    }

    opcoes.forEach((opcao) => {
      if (ehTextoVazio(opcao.rotulo)) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `Uma opção do bloco "${nomeDoBloco(n)}" está sem valor de resposta (rótulo vazio).`,
          nodeId: n.id,
        });
        return;
      }
      // Botão de URL não precisa de caminho: a pessoa sai pro site e não responde nada.
      if (opcao.url?.trim()) return;
      const temAresta = saidas.some((e) => e.sourceHandle === opcao.id);
      if (!temAresta) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `A opção "${opcao.rotulo}" do bloco "${nomeDoBloco(n)}" não leva a lugar nenhum.`,
          nodeId: n.id,
        });
      }
    });
  });

  // 4b. Documento/imagem/vídeo/áudio sem arquivo escolhido (biblioteca ou upload simulado).
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_MIDIA.has(n.type)) return;
    const data = n.data as MensagemMidiaData;
    if (ehTextoVazio(data.arquivoNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem arquivo escolhido.`,
        nodeId: n.id,
      });
    } else if (ehTextoVazio(data.arquivoId)) {
      // O nome é o que aparece na tela, mas quem envia o arquivo é o id. Um bloco com nome e sem
      // id parece pronto no editor e não envia nada na conversa: por isso é erro, não aviso.
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}": o arquivo "${data.arquivoNome}" não ficou guardado na biblioteca. Escolha o arquivo de novo.`,
        nodeId: n.id,
      });
    }
  });

  // 4c. Enviar formulário sem formulário escolhido (ou sem endereço, quando é link externo).
  nodes.forEach((n) => {
    if (n.type !== "enviar_formulario") return;
    const data = n.data as EnviarFormularioData;
    const externo = data.formularioOrigem === "externo";
    if (externo ? ehTextoVazio(data.formularioUrlExterna) : ehTextoVazio(data.formularioId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: externo
          ? `Bloco "${nomeDoBloco(n)}" está sem o endereço do formulário externo.`
          : `Bloco "${nomeDoBloco(n)}" está sem formulário escolhido.`,
        nodeId: n.id,
      });
    }
  });

  // 5. Mensagem de texto/e-mail/notificação vazia.
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_TEXTO.has(n.type)) return;
    const data = n.data as MensagemTextoData & { mensagem?: string };
    const texto = data.texto ?? data.mensagem;
    if (ehTextoVazio(texto)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem texto pra enviar.`,
        nodeId: n.id,
      });
    }
  });

  // 6. Aguardar sem valor/modo válido.
  nodes.forEach((n) => {
    if (n.type !== "aguardar") return;
    const data = n.data as AguardarData;
    // Segundos entra na lista: é a pausa do Social Seller, e "aguardar 0 segundos" é um bloco
    // que não faz nada — exatamente o que esta checagem existe pra pegar.
    const modosComValorObrigatorio: AguardarData["modo"][] = ["segundos", "minutos", "horas", "dias"];
    if (modosComValorObrigatorio.includes(data.modo) && (!data.valor || data.valor <= 0)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "Aguardar" está sem um tempo de espera válido.`,
        nodeId: n.id,
      });
    }
  });

  // 7. condicao_grupo sem nenhuma regra nem subgrupo.
  nodes.forEach((n) => {
    if (n.type !== "condicao_grupo") return;
    const data = n.data as { grupo?: { regras?: unknown[]; subgrupos?: unknown[] } };
    const grupo = data.grupo;
    if (!grupo || ((grupo.regras?.length ?? 0) === 0 && (grupo.subgrupos?.length ?? 0) === 0)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem definir o que verificar.`,
        nodeId: n.id,
      });
    }
  });

  /*
   * 7a. Condição com ramos: ramo vazio, regra sem valor e caminho sem ligação.
   *
   * O ramo VAZIO é o que mais importa, e não é óbvio: um grupo "E" sem nenhuma regra é verdadeiro
   * (todo mundo passa num `every` de lista vazia), então um ramo em branco PEGA TODO MUNDO e os
   * ramos abaixo dele nunca são alcançados. Enquanto ele é o último, é só um caminho largo e o
   * aviso basta; com ramo embaixo, ele apaga os outros em silêncio — e aí é erro.
   */
  nodes.forEach((n) => {
    if (n.type !== "condicao_ramos") return;
    const data = n.data as CondicaoRamosData;
    const ramos = data.ramos ?? [];
    const saidas = saidasPorNo.get(n.id) ?? [];

    if (!ramos.length) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" não tem nenhuma condição: só sobra "Nenhuma das condições".`,
        nodeId: n.id,
      });
    }

    ramos.forEach((ramo, i) => {
      const regras = ramo.grupo?.regras ?? [];
      const vazio = !regras.length && !ramo.grupo?.subgrupos?.length;
      /*
       * CONDIÇÃO SEM REGRA É ERRO, SEMPRE — e não só quando tem outra embaixo.
       *
       * Era aviso na última: "um caminho largo" parecia aceitável. Não é. Um grupo "E" vazio é
       * verdadeiro, então ela pega TODO MUNDO antes de "Nenhuma das condições", que vira um
       * caminho morto — e o bloco inteiro deixa de decidir qualquer coisa continuando com cara de
       * configurado. Desde que toda condição nasce com uma regra (ver `regraPadrao`), chegar aqui
       * vazio só acontece apagando a última regra de propósito.
       */
      if (vazio) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem:
            i < ramos.length - 1
              ? `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} está sem regra, então ela pega todo mundo e as condições abaixo dela nunca acontecem.`
              : `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} está sem regra, então ela pega todo mundo e "Nenhuma das condições" nunca acontece.`,
          nodeId: n.id,
        });
      }

      regras.forEach((regra) => {
        // Campo que saiu do produto (ou foi gravado por uma versão anterior): a regra é
        // inavaliável, e deixar publicar seria deixar o fluxo decidir por um dado que não existe.
        if (!campoDeCondicaoExiste(regra.campo)) {
          problemas.push({
            id: proximoIdProblema(),
            severidade: "erro",
            mensagem: `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} usa um campo que não existe mais ("${regra.campo}").`,
            nodeId: n.id,
          });
          return;
        }
        /*
         * COMPARAÇÃO QUE NÃO COMBINA COM O TIPO DO CAMPO: aviso, não erro.
         *
         * "Data da última conversa começa com" é uma regra que a tela aceitava e que quase nunca
         * pode ser verdadeira. Mas há fluxos PUBLICADOS com regras assim, gravadas quando todo
         * campo oferecia os mesmos onze operadores — e o motor continua avaliando todas elas. Virar
         * erro impediria de republicar um fluxo que está rodando hoje, por causa de uma escolha que
         * o próprio produto ofereceu. Avisa, e quem abrir o bloco troca em dois cliques.
         */
        if (!operadoresDoCampo(regra.campo).some((o) => o.valor === regra.operador)) {
          problemas.push({
            id: proximoIdProblema(),
            severidade: "aviso",
            mensagem: `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} compara "${rotuloDoCampo(regra.campo)}" de um jeito que não combina com esse tipo de campo, e pode nunca ser verdadeira.`,
            nodeId: n.id,
          });
        }
        // "existe"/"não existe" não comparam valor nenhum: cobrar um campo preenchido neles seria
        // pedir uma informação que a regra não usa. Valor que vem de outro campo também não.
        const precisaValor = pedeValor(regra.operador) && fontePedeTexto(regra.fonteValor);
        /*
         * "É UM DESTES" GUARDA A LISTA EM `valores`, não em `valor`.
         *
         * Cobrar `valor` preenchido aqui acusaria de errada uma regra certa com três opções
         * escolhidas — e a pessoa ficaria olhando pra um erro sem ter o que corrigir.
         */
        if (pedeVariosValores(regra.operador)) {
          if (!(regra.valores ?? []).filter((v) => !ehTextoVazio(v)).length) {
            problemas.push({
              id: proximoIdProblema(),
              severidade: "erro",
              mensagem: `Bloco "${nomeDoBloco(n)}": uma regra da condição ${i + 1} está sem nenhum valor escolhido.`,
              nodeId: n.id,
            });
          }
        } else if (precisaValor && ehTextoVazio(regra.valor)) {
          problemas.push({
            id: proximoIdProblema(),
            severidade: "erro",
            mensagem: `Bloco "${nomeDoBloco(n)}": uma regra da condição ${i + 1} está sem valor pra comparar.`,
            nodeId: n.id,
          });
        }
        if (regra.operador === "entre" && !pedeVariosValores(regra.operador)) {
          if (ehTextoVazio(regra.valor) || ehTextoVazio(regra.valorFim)) {
            problemas.push({
              id: proximoIdProblema(),
              severidade: "erro",
              mensagem: `Bloco "${nomeDoBloco(n)}": a regra "entre" da condição ${i + 1} precisa dos dois limites.`,
              nodeId: n.id,
            });
          } else if (intervaloInvertido(regra.valor, regra.valorFim)) {
            // "entre 500 e 100" não é um intervalo: é um intervalo vazio, e nada cai dentro dele.
            problemas.push({
              id: proximoIdProblema(),
              severidade: "erro",
              mensagem: `Bloco "${nomeDoBloco(n)}": a regra "entre" da condição ${i + 1} começa depois de onde termina ("${regra.valor}" a "${regra.valorFim}").`,
              nodeId: n.id,
            });
          }
        }
      });

      /*
       * CONDIÇÃO QUE NUNCA ACONTECE porque uma de cima já pega todo mundo que ela pegaria.
       *
       * "contém consulta" em cima e "é igual a consulta" embaixo: a segunda nunca é alcançada,
       * porque vale a primeira que bater. É aviso e não erro — o fluxo roda, só que com um caminho
       * morto — e a conta é conservadora: só acusa quando toda regra da de cima é mais larga que
       * uma regra da de baixo (ver `condicaoCobre`).
       */
      const cobertaPor = ramos.findIndex((anterior, j) => j < i && condicaoCobre(anterior.grupo, ramo.grupo));
      if (cobertaPor >= 0) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "aviso",
          mensagem: `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} nunca acontece, porque a condição ${cobertaPor + 1} já pega todo mundo que ela pegaria.`,
          nodeId: n.id,
        });
      }

      // Caminho desenhado e sem ligação: avisa, não impede. Pode ser um ramo que a pessoa ainda
      // vai ligar, e bloquear a publicação do fluxo inteiro por causa disso seria demais.
      if (!saidas.some((e) => e.sourceHandle === ramo.id)) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "aviso",
          mensagem: `Bloco "${nomeDoBloco(n)}": a condição ${i + 1} não leva a lugar nenhum. Quem sair por ela para aqui.`,
          nodeId: n.id,
        });
      }
    });

    if (ramos.length && !saidas.some((e) => e.sourceHandle === "senao")) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}": "Nenhuma das condições" não leva a lugar nenhum. Quem não bater em nenhuma condição para aqui.`,
        nodeId: n.id,
      });
    }
  });

  // 7b. Gatilho de etapa (entrou/saiu/parado) sem funil escolhido.
  const TIPOS_GATILHO_ETAPA = new Set(["lead_entrou_etapa", "lead_saiu_etapa", "lead_parado_etapa"]);
  nodes.forEach((n) => {
    if (!TIPOS_GATILHO_ETAPA.has(n.type)) return;
    const data = n.data as GatilhoEtapaData;
    if (ehTextoVazio(data.funilId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem funil e etapa escolhidos.`,
        nodeId: n.id,
      });
    }
  });

  // 7c. Adicionar/remover etiqueta sem etiqueta escolhida.
  const TIPOS_ETIQUETA_ACAO = new Set(["adicionar_etiqueta", "remover_etiqueta"]);
  nodes.forEach((n) => {
    if (!TIPOS_ETIQUETA_ACAO.has(n.type)) return;
    const data = n.data as EtiquetaEventoData;
    if (ehTextoVazio(data.etiquetaNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem etiqueta escolhida.`,
        nodeId: n.id,
      });
    }
  });

  // 7d. Criar tarefa sem título.
  nodes.forEach((n) => {
    if (n.type !== "criar_tarefa") return;
    const data = n.data as CriarTarefaData;
    if (ehTextoVazio(data.titulo)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem título de tarefa definido.`,
        nodeId: n.id,
      });
    }
  });

  // 7e. Gatilho de tarefa (criada/concluída) com filtro escolhido mas sem o valor correspondente.
  const TIPOS_GATILHO_TAREFA = new Set(["tarefa_criada", "tarefa_concluida"]);
  nodes.forEach((n) => {
    if (!TIPOS_GATILHO_TAREFA.has(n.type)) return;
    const data = n.data as TarefaEventoData;
    const faltando =
      (data.filtroModo === "categoria" && ehTextoVazio(data.categoria)) ||
      (data.filtroModo === "titulo" && ehTextoVazio(data.tituloContem)) ||
      (data.filtroModo === "responsavel" && ehTextoVazio(data.responsavel)) ||
      (data.filtroModo === "equipe" && ehTextoVazio(data.equipe)) ||
      (data.filtroModo === "funil" && ehTextoVazio(data.funilId));
    if (faltando) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está com o filtro de tarefa incompleto.`,
        nodeId: n.id,
      });
    }
  });

  // 7f. Encaminhar pra equipe sem equipe escolhida.
  nodes.forEach((n) => {
    if (n.type !== "encaminhar_equipe") return;
    const data = n.data as EncaminharEquipeData;
    if (ehTextoVazio(data.equipeNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem equipe escolhida.`,
        nodeId: n.id,
      });
    }
  });

  // 7g. Atualizar status sem status escolhido, ou "Perdido" sem motivo.
  nodes.forEach((n) => {
    if (n.type !== "atualizar_status") return;
    const data = n.data as AtualizarStatusData;
    if (ehTextoVazio(data.status)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem status escolhido.`,
        nodeId: n.id,
      });
    } else if (data.status === "perdido" && ehTextoVazio(data.motivoPerda)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" marca como perdido mas está sem motivo da perda.`,
        nodeId: n.id,
      });
    }
  });

  // 7h. Atualizar valor do negócio sem valor definido.
  nodes.forEach((n) => {
    if (n.type !== "atualizar_valor") return;
    const data = n.data as AtualizarValorData;
    if (ehTextoVazio(data.valor)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem valor definido.`,
        nodeId: n.id,
      });
    }
  });

  // 7i. Agendar consulta sem data ou horário definidos.
  nodes.forEach((n) => {
    if (n.type !== "agendar_consulta") return;
    const data = n.data as AgendarConsultaData;
    if (ehTextoVazio(data.data) || ehTextoVazio(data.horario)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem data e horário definidos.`,
        nodeId: n.id,
      });
    }
  });

  // 7j. Modelo do WhatsApp sem template escolhido.
  nodes.forEach((n) => {
    if (n.type !== "mensagem_modelo_whatsapp") return;
    const data = n.data as MensagemModeloWhatsappData;
    if (ehTextoVazio(data.templateId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem modelo escolhido.`,
        nodeId: n.id,
      });
    }
  });

  // 7k. Criar negócio sem nome definido.
  nodes.forEach((n) => {
    if (n.type !== "criar_negocio") return;
    const data = n.data as CriarNegocioData;
    if (ehTextoVazio(data.nome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem nome de negócio definido.`,
        nodeId: n.id,
      });
    }
  });

  // 7l. Distribuir por disponibilidade sem equipe escolhida.
  nodes.forEach((n) => {
    if (n.type !== "distribuir_disponibilidade") return;
    const data = n.data as DistribuirDisponibilidadeData;
    if (ehTextoVazio(data.equipeNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem equipe escolhida.`,
        nodeId: n.id,
      });
    }
  });

  // 7m. Encaminhar pra atendimento humano sem destino escolhido (item 20: obrigatório destino, e
  // se mover no funil, também funil+etapa).
  nodes.forEach((n) => {
    if (n.type !== "encaminhar_humano") return;
    const data = n.data as EncaminharHumanoData;
    const semDestino =
      (data.destino === "atendente" && ehTextoVazio(data.atendenteNome)) ||
      (data.destino === "equipe" && ehTextoVazio(data.equipeNome));
    if (semDestino) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem atendente ou equipe escolhidos.`,
        nodeId: n.id,
      });
    } else if (data.moverFunil && ehTextoVazio(data.funilId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" vai mover o lead no funil, mas está sem funil e etapa escolhidos.`,
        nodeId: n.id,
      });
    }
  });

  // 7n. Cancelar agendamento: precisa do critério, e se enviar mensagem, precisa do
  // canal/mensagem-ou-modelo.
  nodes.forEach((n) => {
    if (n.type !== "cancelar_agendamento") return;
    const data = n.data as CancelarAgendamentoData;
    if (ehTextoVazio(data.criterio)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem definir qual agendamento será cancelado.`,
        nodeId: n.id,
      });
    } else if (data.enviarMensagem && data.origemMensagem === "modelo" && ehTextoVazio(data.modeloId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" vai enviar mensagem, mas está sem modelo escolhido.`,
        nodeId: n.id,
      });
    } else if (data.enviarMensagem && data.origemMensagem !== "modelo" && ehTextoVazio(data.mensagem)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" vai enviar mensagem, mas está sem o texto da mensagem.`,
        nodeId: n.id,
      });
    }
  });

  // 7o. Enviar contato: precisa do contato (quando "outro") e do destino.
  nodes.forEach((n) => {
    if (n.type !== "mensagem_contato") return;
    const data = n.data as MensagemContatoData;
    if (data.origemContato === "outro" && ehTextoVazio(data.contatoSelecionadoNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem o contato escolhido.`,
        nodeId: n.id,
      });
    } else {
      const destinoFaltando =
        (data.destinoModo === "atendente" && ehTextoVazio(data.destinoAtendente)) ||
        (data.destinoModo === "equipe" && ehTextoVazio(data.destinoEquipe)) ||
        (data.destinoModo === "numero" && ehTextoVazio(data.destinoNumero));
      if (destinoFaltando) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `Bloco "${nomeDoBloco(n)}" está sem o destino de envio escolhido.`,
          nodeId: n.id,
        });
      }
    }
  });

  // 7p. Enviar localização: precisa de uma localização definida conforme a origem escolhida.
  nodes.forEach((n) => {
    if (n.type !== "mensagem_localizacao") return;
    const data = n.data as MensagemLocalizacaoData;
    const semLocalizacao =
      (data.origem === "salva" && ehTextoVazio(data.localSalvoId)) ||
      (data.origem === "endereco" && ehTextoVazio(data.nomeLocal)) ||
      (data.origem === "coordenadas" && (ehTextoVazio(data.latitude) || ehTextoVazio(data.longitude)));
    if (semLocalizacao) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem uma localização definida.`,
        nodeId: n.id,
      });
    }
  });

  // 7q. Enviar e-mail: precisa de destinatário (quando específico/campo) e de assunto/corpo.
  nodes.forEach((n) => {
    if (n.type !== "mensagem_email") return;
    const data = n.data as MensagemEmailData;
    const destinatarioFaltando =
      (data.destinatarioModo === "especifico" || data.destinatarioModo === "outro_campo" || data.destinatarioModo === "campo_personalizado") &&
      ehTextoVazio(data.destinatarioEspecifico);
    if (destinatarioFaltando) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem o destinatário definido.`,
        nodeId: n.id,
      });
    } else if (ehTextoVazio(data.assunto) || ehTextoVazio(data.corpo)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${nomeDoBloco(n)}" está sem destinatário e conteúdo definidos.`,
        nodeId: n.id,
      });
    }
  });

  /*
   * 7.1 CONDIÇÃO DE INSTAGRAM NUM CRM SEM INSTAGRAM CONECTADO.
   *
   * Os campos do grupo Instagram saem do perfil que a Meta devolve e do evento que disparou o
   * fluxo. Sem a conta conectada eles não existem — e a regra responde "não existe" pra todo
   * mundo, o que manda TODOS os leads pelo mesmo caminho. O fluxo roda, não dá erro, e decide
   * sempre igual: é o tipo de defeito que só aparece quando alguém compara o resultado com o que
   * esperava.
   *
   * Aviso e não erro: a pessoa pode estar montando a automação ANTES de conectar a conta, que é
   * uma ordem perfeitamente razoável de trabalhar.
   */
  if (contexto.instagramConectado === false) {
    const comCampoDeInstagram = nodes.filter((n) => {
      const dados = (n.data ?? {}) as { grupo?: GrupoCondicoes; ramos?: { grupo?: GrupoCondicoes }[] };
      const grupos = [dados.grupo, ...(dados.ramos ?? []).map((r) => r.grupo)];
      return grupos.some((g) => grupoUsaCampoDeInstagram(g));
    });
    comCampoDeInstagram.forEach((n) => {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${nomeDoBloco(n)}" usa campos do Instagram, mas o Instagram não está conectado: essas regras não vão decidir nada.`,
        nodeId: n.id,
      });
    });
  }

  /*
   * 7.2 MANDAR MENSAGEM DEPOIS DE SABER QUE A JANELA FECHOU.
   *
   * "Dentro da janela de 24h: é falso" é a pergunta que existe justamente pra tratar quem a Meta
   * não deixa mais responder. Ligar um envio de mensagem nesse caminho é desenhar uma entrega que
   * a Meta vai recusar — e o fluxo segue como se tivesse mandado.
   *
   * O que cabe ali é outra coisa: etiquetar, criar tarefa, avisar o time, responder o comentário
   * em público. Por isso é aviso: o caminho pode estar certo, e quem decide é quem montou.
   */
  nodes.forEach((n) => {
    const saidaFechada = saidaDeJanelaFechada(n);
    if (!saidaFechada) return;
    const alvos = (saidasPorNo.get(n.id) ?? []).filter((e) => (e.sourceHandle ?? "") === saidaFechada.handle);
    const mensagemAdiante = alvos.some((e) => alcancaEnvioDeMensagem(e.target, nodesPorId, saidasPorNo));
    if (!mensagemAdiante) return;
    problemas.push({
      id: proximoIdProblema(),
      severidade: "aviso",
      mensagem: `Bloco "${nomeDoBloco(n)}": o caminho de quem está FORA da janela de 24h leva a um envio de mensagem, e o Instagram recusa mensagem fora dela.`,
      nodeId: n.id,
    });
  });

  /*
   * 7.3 RESPOSTA PÚBLICA NUM FLUXO QUE NÃO COMEÇA POR COMENTÁRIO.
   *
   * O bloco de texto do Instagram escolhe onde escreve: Direct ou embaixo do comentário (ver
   * `DESTINOS_INSTAGRAM`). A resposta pública precisa de um comentário pra pendurar, e quem dá
   * esse comentário é o GATILHO. Num fluxo que começa por Direct recebido, por resposta de story
   * ou por menção, o motor não tem onde publicar: registra "ignorado, este disparo não veio de um
   * comentário" e segue. O passo simplesmente não acontece.
   *
   * Aviso, não erro, e por uma razão concreta: o mesmo fluxo pode ter DOIS gatilhos, um de
   * comentário e um de Direct. Aí o passo funciona pra metade das execuções, o que é uma escolha
   * legítima — e dizer "erro" impediria de publicar um fluxo correto.
   */
  const gatilhosDeComentario = ["comentario_instagram", "instagram_comentario_live", "instagram_resposta_comentario"];
  const temGatilhoDeComentario = nodes.some(
    (n) => n.category === "gatilho" && gatilhosDeComentario.includes(n.type),
  );
  if (!temGatilhoDeComentario) {
    nodes
      .filter((n) => ((n.data ?? {}) as { destino?: string }).destino === "comentario")
      .forEach((n) => {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "aviso",
          mensagem: `Bloco "${nomeDoBloco(n)}" responde EM PÚBLICO, embaixo do comentário, mas nenhum gatilho deste fluxo é de comentário: esse passo vai ser ignorado. Troque pra Direct ou acrescente o gatilho de comentário.`,
          nodeId: n.id,
        });
      });
  }

  // 8. Ciclo: heurística simples: DFS de detecção de ciclo; se o ciclo não
  // passar por nenhum nó "aguardar" ou "condicao_grupo", é risco real de loop
  // infinito (nada quebra o círculo nem no tempo, nem numa condição).
  const ciclosDetectados = detectarCiclosDeLoopInfinito(nodes, edges, nodesPorId);
  ciclosDetectados.forEach((nodeId) => {
    problemas.push({
      id: proximoIdProblema(),
      severidade: "erro",
      mensagem: `Bloco "${nomeDoBloco(nodesPorId.get(nodeId), nodeId)}" faz parte de um ciclo sem espera nem condição. Risco de loop infinito.`,
      nodeId,
    });
  });

  return problemas.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "erro" ? -1 : 1));
}

/**
 * DFS clássica com pilha de recursão pra achar ciclos. Pra cada ciclo achado,
 * se nenhum nó dele "quebra o loop" (aguardar/condição), marca todos os nós
 * do ciclo como problematicos. Não tenta achar TODOS os ciclos possíveis.
 * Só o suficiente pra avisar o usuário, sem virar um analisador completo de grafos.
 */
function detectarCiclosDeLoopInfinito(
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodesPorId: Map<string, FlowNode>,
): Set<string> {
  const adjacencia = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adjacencia.has(e.source)) adjacencia.set(e.source, []);
    adjacencia.get(e.source)!.push(e.target);
  });

  const problematicos = new Set<string>();
  const visitados = new Set<string>();
  const pilha: string[] = [];
  const naPilha = new Set<string>();

  function quebraLoop(nodeId: string): boolean {
    const n = nodesPorId.get(nodeId);
    return n?.type === "aguardar" || n?.type === "condicao_grupo";
  }

  function dfs(nodeId: string) {
    visitados.add(nodeId);
    pilha.push(nodeId);
    naPilha.add(nodeId);

    for (const proximo of adjacencia.get(nodeId) ?? []) {
      if (!visitados.has(proximo)) {
        dfs(proximo);
      } else if (naPilha.has(proximo)) {
        const inicio = pilha.indexOf(proximo);
        const ciclo = pilha.slice(inicio);
        const temQuebraLoop = ciclo.some(quebraLoop);
        if (!temQuebraLoop) {
          ciclo.forEach((id) => problematicos.add(id));
        }
      }
    }

    pilha.pop();
    naPilha.delete(nodeId);
  }

  nodes.forEach((n) => {
    if (!visitados.has(n.id)) dfs(n.id);
  });

  return problematicos;
}

/* -------------------------------------------------------------------------- */
/* Intervalo e cobertura entre condições                                      */
/* -------------------------------------------------------------------------- */

/** "entre 500 e 100": um intervalo que começa depois de onde termina não contém nada. */
export function intervaloInvertido(de: string | undefined, ate: string | undefined): boolean {
  if (!de?.trim() || !ate?.trim()) return false;
  const a = numeroDeTexto(de);
  const b = numeroDeTexto(ate);
  if (a !== undefined && b !== undefined) return a > b;
  // Data ISO e hora "HH:MM" se ordenam como texto; qualquer outro texto também, e aí a conta
  // continua valendo pra quem digitou "de Z a A".
  return de.trim().toLowerCase() > ate.trim().toLowerCase();
}

function comparavel(v: string | undefined): string {
  return (v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * A REGRA `a` PEGA TUDO QUE A REGRA `b` PEGARIA?
 *
 * Conservadora de propósito: na dúvida, responde "não". Um aviso errado de "esta condição nunca
 * acontece" é pior que aviso nenhum — manda a pessoa apagar um caminho que funciona.
 */
export function regraCobre(a: RegraCondicao, b: RegraCondicao): boolean {
  if (a.campo !== b.campo) return false;
  // Valor que vem de outro campo muda a cada lead: não dá pra afirmar nada sobre ele aqui.
  if ((a.fonteValor && a.fonteValor !== "manual") || (b.fonteValor && b.fonteValor !== "manual")) return false;
  const va = comparavel(a.valor);
  const vb = comparavel(b.valor);
  if (a.operador === "existe") return b.operador !== "nao_existe" && Boolean(vb);
  if (a.operador === b.operador && va === vb) return true;
  if (a.operador === "contem") {
    if (b.operador === "igual" || b.operador === "contem" || b.operador === "comeca_com" || b.operador === "termina_com") {
      return Boolean(va) && vb.includes(va);
    }
  }
  if (a.operador === "comeca_com" && (b.operador === "igual" || b.operador === "comeca_com")) {
    return Boolean(va) && vb.startsWith(va);
  }
  if (a.operador === "termina_com" && (b.operador === "igual" || b.operador === "termina_com")) {
    return Boolean(va) && vb.endsWith(va);
  }
  return false;
}

/**
 * A condição `a`, que está ACIMA, já pega todo mundo que a condição `b` pegaria?
 *
 * Só vale pra grupos "E" sem subgrupos, que é o que o cartão escreve: com OU e NÃO no meio, a
 * conta deixa de ser uma comparação regra a regra e um palpite errado custa mais que o aviso vale.
 */
export function condicaoCobre(a: GrupoCondicoes | undefined, b: GrupoCondicoes | undefined): boolean {
  if (!a || !b) return false;
  if (a.tipo !== "E" || b.tipo !== "E") return false;
  if (a.subgrupos?.length || b.subgrupos?.length) return false;
  const deA = a.regras ?? [];
  const deB = b.regras ?? [];
  if (!deA.length || !deB.length) return false;
  // Toda regra da de cima precisa ser mais larga que alguma da de baixo. Se ela exige algo que a
  // de baixo não exige, quem passa na de baixo pode não passar na de cima — e aí não cobre.
  return deA.every((ra) => deB.some((rb) => regraCobre(ra, rb)));
}

/** Alguma regra deste grupo (ou dos subgrupos) pergunta por um campo do Instagram? */
function grupoUsaCampoDeInstagram(grupo: GrupoCondicoes | undefined): boolean {
  if (!grupo) return false;
  if ((grupo.regras ?? []).some((r) => ehCampoDeInstagram(r.campo))) return true;
  return (grupo.subgrupos ?? []).some((sub) => grupoUsaCampoDeInstagram(sub));
}

/**
 * QUAL SAÍDA DESTE BLOCO É A DE "A JANELA DE 24H ESTÁ FECHADA".
 *
 * No bloco de sim/não é a saída "nao" quando a regra pergunta se está DENTRO da janela, e a "sim"
 * quando ela pergunta se está fora. No bloco de vários caminhos é a saída do ramo cuja regra diz
 * que a janela está fechada. Devolve `null` quando o bloco não pergunta isso.
 */
function saidaDeJanelaFechada(no: FlowNode): { handle: string } | null {
  const dados = (no.data ?? {}) as { grupo?: GrupoCondicoes; ramos?: { id: string; grupo?: GrupoCondicoes }[] };

  const fechada = (grupo: GrupoCondicoes | undefined, quandoVerdadeiro: boolean): boolean => {
    const regra = (grupo?.regras ?? []).find((r) => r.campo === "ig_janela_24h");
    if (!regra) return false;
    // "é falso" (ou o antigo "é igual a: não") no caminho verdadeiro; "é verdadeiro" no falso.
    const perguntaSeEstaDentro =
      regra.operador === "verdadeiro" || (regra.operador === "igual" && (regra.valor ?? "") !== "nao");
    return quandoVerdadeiro ? !perguntaSeEstaDentro : perguntaSeEstaDentro;
  };

  if (no.type === "condicao_grupo") {
    if (fechada(dados.grupo, true)) return { handle: "sim" };
    if (fechada(dados.grupo, false)) return { handle: "nao" };
    return null;
  }
  if (no.type === "condicao_ramos") {
    const ramo = (dados.ramos ?? []).find((r) => fechada(r.grupo, true));
    return ramo ? { handle: ramo.id } : null;
  }
  return null;
}

/** Deste bloco em diante, alguma mensagem é enviada? Caminha pra frente até achar uma ou acabar. */
function alcancaEnvioDeMensagem(
  inicio: string,
  nodesPorId: Map<string, FlowNode>,
  saidasPorNo: Map<string, FlowEdge[]>,
): boolean {
  const vistos = new Set<string>();
  const fila = [inicio];
  while (fila.length) {
    const id = fila.shift()!;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const no = nodesPorId.get(id);
    if (!no) continue;
    if (no.category === "mensagem") return true;
    // Parar no próximo gatilho/condição seria esconder o envio que está logo depois dela: o
    // caminho inteiro adiante continua sendo "o que acontece com quem está fora da janela".
    (saidasPorNo.get(id) ?? []).forEach((e) => fila.push(e.target));
  }
  return false;
}
