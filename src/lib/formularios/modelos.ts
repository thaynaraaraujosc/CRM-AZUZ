import type { PerguntaFormulario, TipoCampoFormulario } from "@/lib/formularios-context";

/**
 * OS FORMULÁRIOS QUE TODA EMPRESA MANDA, prontos pra usar.
 *
 * POR QUE MODELO E NÃO FORMULÁRIO CRIADO: criar quatro formulários na conta de alguém sem que a
 * pessoa tenha pedido é encher a tela dela. Modelo fica quieto até alguém escolher — e o que
 * nasce do modelo é um formulário comum, que se edita e se apaga como qualquer outro. Também é o
 * que permite o mesmo trabalho servir a qualquer cliente do CRM: nada aqui é de um negócio
 * específico.
 *
 * NASCEM COMO RASCUNHO. Formulário só vira link depois de publicado, e quase sempre se troca uma
 * ou duas perguntas antes — publicar sozinho entregaria ao cliente uma pergunta que ninguém leu.
 *
 * UMA PÁGINA SÓ. O que seria página vira SEÇÃO: um campo de título no meio da lista, que separa
 * sem quebrar. Quem responde rola uma página; quem monta continua vendo onde um assunto termina e
 * outro começa. (O construtor do CRM continua aceitando várias páginas; os modelos é que não
 * nascem assim.)
 *
 * NADA DE SENHA, DOCUMENTO NEM PAGAMENTO. O link é público: CPF, cartão e senha não se pedem por
 * aqui.
 */

type Campo = {
  tipo: TipoCampoFormulario;
  rotulo: string;
  descricao?: string;
  obrigatoria?: boolean;
  opcoes?: string[];
  placeholder?: string;
  largura?: "total" | "metade";
};

/** Um trecho do formulário. Vira um campo de título seguido das perguntas dele — não uma página. */
export type SecaoDoModelo = { titulo: string; campos: Campo[] };

export type ModeloDeFormulario = {
  id: string;
  nome: string;
  /** A descrição que o próprio formulário mostra a quem responde. */
  descricao: string;
  /** Uma linha pra agência escolher na tela: quando este formulário é usado. */
  quando: string;
  mensagemFinal: string;
  secoes: SecaoDoModelo[];
};

export const MODELOS_DE_FORMULARIO: ModeloDeFormulario[] = [
  {
    id: "briefing-de-marca",
    nome: "Briefing da marca",
    descricao: "Pra gente escrever com a sua voz desde o primeiro post. Leva uns 10 minutos.",
    quando: "No começo do contrato, antes do primeiro conteúdo",
    mensagemFinal: "Recebemos tudo. Já vamos montar o primeiro mês e te chamamos pra alinhar.",
    secoes: [
      {
        titulo: "A marca",
        campos: [
          { tipo: "texto_curto", rotulo: "Nome da marca", obrigatoria: true },
          { tipo: "texto_curto", rotulo: "Em uma frase, o que vocês vendem", obrigatoria: true },
          { tipo: "url", rotulo: "Site", largura: "metade" },
          { tipo: "texto_curto", rotulo: "Perfis nas redes", largura: "metade", placeholder: "@perfil" },
          { tipo: "texto_curto", rotulo: "Há quanto tempo no mercado", largura: "metade" },
          { tipo: "texto_curto", rotulo: "Onde vocês atendem", largura: "metade", placeholder: "Cidade, região, online" },
        ],
      },
      {
        titulo: "Quem compra",
        campos: [
          {
            tipo: "texto_longo",
            rotulo: "Quem é o cliente ideal",
            descricao: "Idade, onde mora, o que faz, o que ele já tentou antes de procurar vocês.",
            obrigatoria: true,
          },
          { tipo: "texto_longo", rotulo: "Que problema vocês resolvem pra ele", obrigatoria: true },
          { tipo: "texto_longo", rotulo: "O que faz alguém desistir de comprar", descricao: "Preço, medo, falta de tempo, desconfiança — o que vocês mais escutam." },
        ],
      },
      {
        titulo: "Voz e limites",
        campos: [
          {
            tipo: "opcao_unica",
            rotulo: "Como a marca fala",
            obrigatoria: true,
            opcoes: ["Próxima e informal", "Profissional e direta", "Acolhedora e explicativa", "Técnica", "Divertida"],
          },
          {
            tipo: "texto_longo",
            rotulo: "Palavras e assuntos que a marca NÃO usa",
            descricao: "O que está fora, por decisão de vocês ou por regra da profissão.",
            obrigatoria: true,
          },
          { tipo: "texto_longo", rotulo: "Quem pode aparecer nos vídeos", descricao: "Nome e função de cada pessoa. Se ninguém aparece, escreva isso." },
        ],
      },
      {
        titulo: "Referências",
        campos: [
          { tipo: "texto_longo", rotulo: "Três perfis que vocês admiram, e por quê" },
          { tipo: "texto_longo", rotulo: "Concorrentes diretos" },
          { tipo: "texto_longo", rotulo: "O que já foi tentado e não funcionou", descricao: "Poupa a gente de repetir." },
        ],
      },
      {
        titulo: "Como vamos trabalhar",
        campos: [
          { tipo: "texto_curto", rotulo: "Quem aprova o conteúdo", obrigatoria: true, largura: "metade" },
          { tipo: "email", rotulo: "E-mail de quem aprova", obrigatoria: true, largura: "metade" },
          { tipo: "telefone", rotulo: "WhatsApp de quem aprova", largura: "metade" },
          { tipo: "texto_curto", rotulo: "Melhor dia e horário pra gravar", largura: "metade" },
          { tipo: "url", rotulo: "Link da pasta com logo, cores e fontes", descricao: "Drive, Dropbox, o que vocês usarem." },
        ],
      },
    ],
  },
  {
    id: "briefing-de-campanha",
    nome: "Briefing de campanha",
    descricao: "Uma ação específica: promoção, lançamento, data comemorativa.",
    quando: "Antes de qualquer ação com data e oferta",
    mensagemFinal: "Anotado. Vamos montar a campanha e te mandar pra aprovar antes de qualquer coisa ir ao ar.",
    secoes: [
      {
        titulo: "A campanha",
        campos: [
          { tipo: "texto_curto", rotulo: "Nome da campanha", obrigatoria: true },
          {
            tipo: "opcao_unica",
            rotulo: "O que ela precisa conseguir",
            obrigatoria: true,
            opcoes: ["Vender", "Gerar contato", "Encher a agenda", "Lançar algo novo", "Ser mais conhecida"],
          },
          { tipo: "texto_longo", rotulo: "O que exatamente está sendo oferecido", obrigatoria: true },
          { tipo: "texto_curto", rotulo: "Preço e forma de pagamento", largura: "metade" },
          { tipo: "numero", rotulo: "Quantas vagas ou unidades", largura: "metade" },
        ],
      },
      {
        titulo: "Prazo e público",
        campos: [
          { tipo: "data", rotulo: "Começa em", obrigatoria: true, largura: "metade" },
          { tipo: "data", rotulo: "Termina em", largura: "metade" },
          { tipo: "texto_longo", rotulo: "Pra quem é esta campanha", descricao: "Se for diferente do público de sempre, diga em que muda." },
        ],
      },
      {
        titulo: "Argumentos",
        campos: [
          { tipo: "texto_longo", rotulo: "Por que comprar agora", obrigatoria: true },
          { tipo: "texto_longo", rotulo: "Prova que a gente pode mostrar", descricao: "Resultado, número, depoimento, antes e depois." },
          { tipo: "texto_longo", rotulo: "O que não pode ser dito" },
        ],
      },
      {
        titulo: "Onde e quanto",
        campos: [
          {
            tipo: "checkbox",
            rotulo: "Onde a campanha vai rodar",
            opcoes: ["Instagram", "Facebook", "TikTok", "Google", "WhatsApp", "E-mail"],
          },
          { tipo: "moeda", rotulo: "Verba prevista para anúncio", largura: "metade" },
          { tipo: "url", rotulo: "Para onde o clique leva", largura: "metade", placeholder: "Link, WhatsApp, site" },
        ],
      },
    ],
  },
  {
    id: "pedido-de-conteudo",
    nome: "Pedido de conteúdo",
    descricao: "Tem um assunto que você quer ver no perfil? Manda por aqui.",
    quando: "Quando o cliente quer sugerir tema fora do planejado",
    mensagemFinal: "Recebido. Entra na fila de ideias do mês e a gente te responde se cabe no calendário.",
    secoes: [
      {
        titulo: "Sua ideia",
        campos: [
          { tipo: "texto_longo", rotulo: "Sobre o que você quer falar", obrigatoria: true },
          { tipo: "texto_longo", rotulo: "Por que agora", descricao: "Aconteceu alguma coisa, entrou produto novo, cliente perguntou muito?" },
          {
            tipo: "opcao_unica",
            rotulo: "Formato que você imagina",
            opcoes: ["Vídeo", "Carrossel", "Imagem", "Tanto faz, vocês decidem"],
          },
          { tipo: "texto_longo", rotulo: "Tem alguma referência? Cola o link aqui" },
          { tipo: "sim_nao", rotulo: "É urgente", largura: "metade" },
          { tipo: "data", rotulo: "Se for, precisa estar no ar até", largura: "metade" },
        ],
      },
    ],
  },
  {
    id: "pesquisa-de-satisfacao",
    nome: "Pesquisa de satisfação",
    descricao: "Dois minutos. O que você responder aqui muda o que a gente faz no mês que vem.",
    quando: "A cada seis meses, com cada cliente",
    mensagemFinal: "Obrigado pela sinceridade. O que você escreveu vai ser lido por quem cuida da sua conta.",
    secoes: [
      {
        titulo: "De modo geral",
        campos: [
          {
            tipo: "nota",
            rotulo: "De 0 a 10, o quanto você indicaria a gente para outra pessoa",
            obrigatoria: true,
          },
          { tipo: "texto_longo", rotulo: "O que mais te agrada hoje" },
          { tipo: "texto_longo", rotulo: "O que mais te incomoda hoje", descricao: "Pode ser direto. É pra isso que a pergunta existe." },
        ],
      },
      {
        titulo: "Item por item",
        campos: [
          { tipo: "avaliacao", rotulo: "Entrega no prazo", largura: "metade" },
          { tipo: "avaliacao", rotulo: "Qualidade do conteúdo", largura: "metade" },
          { tipo: "avaliacao", rotulo: "Comunicação com você", largura: "metade" },
          { tipo: "avaliacao", rotulo: "Resultado que você percebe", largura: "metade" },
        ],
      },
      {
        titulo: "Daqui pra frente",
        campos: [
          { tipo: "texto_longo", rotulo: "O que a gente deveria começar a fazer" },
          { tipo: "texto_longo", rotulo: "O que a gente deveria parar de fazer" },
          { tipo: "sim_nao", rotulo: "Podemos usar o que você escreveu como depoimento" },
        ],
      },
    ],
  },
];

/**
 * O modelo inteiro vira UMA lista de perguntas: o título de cada seção entra como um campo de
 * layout (`titulo`), e depois as perguntas dela. Com uma seção só, o título é dispensável — a
 * descrição do formulário já diz do que se trata.
 */
export function perguntasDoModelo(modelo: ModeloDeFormulario, novoId: () => string): PerguntaFormulario[] {
  const saida: PerguntaFormulario[] = [];
  for (const secao of modelo.secoes) {
    if (modelo.secoes.length > 1) {
      saida.push(perguntaDoModelo({ tipo: "titulo", rotulo: secao.titulo }, novoId()));
    }
    for (const campo of secao.campos) saida.push(perguntaDoModelo(campo, novoId()));
  }
  return saida;
}

/** O campo do modelo vira pergunta de verdade, com o id novo e os padrões do construtor. */
export function perguntaDoModelo(campo: Campo, id: string): PerguntaFormulario {
  return {
    id,
    tipo: campo.tipo,
    rotulo: campo.rotulo,
    descricao: campo.descricao,
    placeholder: campo.placeholder,
    obrigatoria: campo.obrigatoria ?? false,
    oculta: false,
    somenteLeitura: false,
    largura: campo.largura ?? "total",
    opcoes: campo.opcoes,
  };
}
