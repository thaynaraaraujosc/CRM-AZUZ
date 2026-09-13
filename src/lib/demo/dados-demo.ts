/**
 * A conta de demonstração: um workspace inteiro de mentira, para mostrar o produto.
 *
 * POR QUE EXISTE: até aqui, demonstrar o CRM para um interessado (ou gravar o vídeo de
 * apresentação) significava abrir a conta real e deixar na tela o nome, o telefone e a conversa de
 * clientes de verdade. Isso é problema de LGPD no dia em que o vídeo for ao ar, e é constrangedor
 * numa reunião de venda.
 *
 * Também resolve o problema oposto: uma conta nova está vazia, e produto vazio não demonstra nada.
 * Funil sem card, conversa sem mensagem e relatório sem número parecem um produto que não faz
 * nada. Aqui os dados já vêm com movimento: negócio em várias etapas, conversa com ida e volta,
 * tarefa atrasada, negócio ganho e negócio perdido com motivo.
 *
 * NADA AQUI É REAL. Os nomes são inventados e os telefones seguem um bloco sequencial artificial
 * (98800-0001 em diante), escolhido para não cair em número de pessoa de verdade se alguém ligar
 * para o que aparecer na tela do vídeo.
 *
 * Este arquivo é só DADO e função pura: não fala com o banco. Quem grava é
 * `POST /api/admin/demo`. A separação existe para dar pra conferir o conteúdo (que é o que aparece
 * no vídeo) sem precisar de banco nenhum no teste.
 */

export const WORKSPACE_DEMO = "demonstracao";
export const EMAIL_DEMO = "demo@azuzcrm.com.br";
export const EMPRESA_DEMO = "Clínica Aurora";

/** Telefones da demonstração começam aqui e seguem em sequência. Ver o aviso no topo. */
const TELEFONE_BASE = 8_800_001;

export function telefoneDemo(indice: number): string {
  const numero = String(TELEFONE_BASE + indice).padStart(8, "0");
  return `(11) 9${numero.slice(0, 4)}-${numero.slice(4)}`;
}

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export type ContatoDemo = {
  nome: string;
  origem: string;
  etapa: string;
  responsavel: string;
  ultima: string;
  valor: string;
  email: string;
  canal: "WhatsApp" | "Instagram";
  cidade: string;
};

/**
 * As etapas do funil da demonstração.
 *
 * Nomes de clínica porque é o segmento mais comum entre quem compra CRM no Brasil, e porque dá
 * uma sequência que qualquer pessoa entende sem explicação, mesmo quem nunca viu um funil.
 */
export const ETAPAS_DEMO = [
  "Novo lead",
  "Em contato",
  "Avaliação agendada",
  "Proposta enviada",
  "Fechado",
] as const;

export const RESPONSAVEIS_DEMO = ["Paula Mendes", "Rafael Correia", "Sofia Queiroz"] as const;

export const CONTATOS_DEMO: ContatoDemo[] = [
  {
    nome: "Amanda Ribeiro",
    origem: "Instagram",
    etapa: "Proposta enviada",
    responsavel: "Paula Mendes",
    ultima: "Recebi sim, vou ver com meu marido e te falo",
    valor: "R$ 2.400",
    email: "amanda.ribeiro@exemplo.com.br",
    canal: "Instagram",
    cidade: "São Paulo",
  },
  {
    nome: "Bruno Carvalho",
    origem: "Indicação",
    etapa: "Avaliação agendada",
    responsavel: "Rafael Correia",
    ultima: "Confirmado pra quinta às 15h",
    valor: "R$ 1.800",
    email: "bruno.carvalho@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "Guarulhos",
  },
  {
    nome: "Camila Nogueira",
    origem: "Formulário",
    etapa: "Novo lead",
    responsavel: "Paula Mendes",
    ultima: "Oi! Vi o anúncio de vocês, queria saber os valores",
    valor: "R$ 0",
    email: "camila.nogueira@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "São Paulo",
  },
  {
    nome: "Diego Prates",
    origem: "Google",
    etapa: "Em contato",
    responsavel: "Sofia Queiroz",
    ultima: "Vocês atendem sábado de manhã?",
    valor: "R$ 950",
    email: "diego.prates@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "Osasco",
  },
  {
    nome: "Eduarda Lins",
    origem: "Instagram",
    etapa: "Fechado",
    responsavel: "Paula Mendes",
    ultima: "Paguei agora, mandei o comprovante",
    valor: "R$ 3.600",
    email: "eduarda.lins@exemplo.com.br",
    canal: "Instagram",
    cidade: "São Paulo",
  },
  {
    nome: "Felipe Andrade",
    origem: "Indicação",
    etapa: "Proposta enviada",
    responsavel: "Rafael Correia",
    ultima: "Consegue parcelar em quantas vezes?",
    valor: "R$ 5.200",
    email: "felipe.andrade@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "Santo André",
  },
  {
    nome: "Gabriela Matos",
    origem: "Formulário",
    etapa: "Em contato",
    responsavel: "Sofia Queiroz",
    ultima: "Pode me mandar mais detalhes por favor",
    valor: "R$ 1.200",
    email: "gabriela.matos@exemplo.com.br",
    canal: "Instagram",
    cidade: "São Paulo",
  },
  {
    nome: "Henrique Salles",
    origem: "Google",
    etapa: "Novo lead",
    responsavel: "Rafael Correia",
    ultima: "Bom dia, vocês ficam em qual endereço?",
    valor: "R$ 0",
    email: "henrique.salles@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "São Bernardo",
  },
  {
    nome: "Isabela Duarte",
    origem: "Instagram",
    etapa: "Avaliação agendada",
    responsavel: "Paula Mendes",
    ultima: "Perfeito, até terça então",
    valor: "R$ 2.100",
    email: "isabela.duarte@exemplo.com.br",
    canal: "Instagram",
    cidade: "São Paulo",
  },
  {
    nome: "Juliana Peixoto",
    origem: "Formulário",
    etapa: "Fechado",
    responsavel: "Sofia Queiroz",
    ultima: "Adorei o resultado, já indiquei pra duas amigas",
    valor: "R$ 4.800",
    email: "juliana.peixoto@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "Diadema",
  },
  {
    nome: "Marcos Tavares",
    origem: "Indicação",
    etapa: "Em contato",
    responsavel: "Rafael Correia",
    ultima: "Vou pensar e te retorno semana que vem",
    valor: "R$ 1.500",
    email: "marcos.tavares@exemplo.com.br",
    canal: "WhatsApp",
    cidade: "São Paulo",
  },
  {
    nome: "Natália Bastos",
    origem: "Google",
    etapa: "Novo lead",
    responsavel: "Paula Mendes",
    ultima: "Oi, tem horário essa semana ainda?",
    valor: "R$ 0",
    email: "natalia.bastos@exemplo.com.br",
    canal: "Instagram",
    cidade: "Barueri",
  },
];

export type MensagemDemo = { de: "cliente" | "empresa"; texto: string; minutosAtras: number };

/**
 * As conversas. São o que mais aparece no vídeo, então precisam soar como conversa de verdade:
 * frase curta, pergunta de preço, remarcação, cliente que some. Diálogo de propaganda ("Olá! Como
 * posso ajudá-lo hoje?") denuncia na hora que a tela é falsa.
 */
export const CONVERSAS_DEMO: Record<string, MensagemDemo[]> = {
  "Amanda Ribeiro": [
    { de: "cliente", texto: "Oi! Vi no Instagram de vocês o procedimento de limpeza de pele", minutosAtras: 2880 },
    { de: "empresa", texto: "Oi Amanda, tudo bem? Tudo certo, faço sim! Quer que eu te explique como funciona?", minutosAtras: 2875 },
    { de: "cliente", texto: "Quero sim. E quanto fica?", minutosAtras: 2860 },
    { de: "empresa", texto: "A sessão sai R$ 400, e no pacote de 6 fica R$ 2.400 podendo parcelar. Te mando a proposta completa?", minutosAtras: 2850 },
    { de: "cliente", texto: "Pode mandar", minutosAtras: 2840 },
    { de: "empresa", texto: "Enviei agora no seu e-mail. Qualquer dúvida é só chamar!", minutosAtras: 2835 },
    { de: "cliente", texto: "Recebi sim, vou ver com meu marido e te falo", minutosAtras: 1440 },
  ],
  "Bruno Carvalho": [
    { de: "cliente", texto: "Boa tarde, a Juliana me indicou vocês", minutosAtras: 720 },
    { de: "empresa", texto: "Que ótimo, Bruno! A Juliana é nossa cliente há bastante tempo. Como posso te ajudar?", minutosAtras: 710 },
    { de: "cliente", texto: "Queria marcar uma avaliação", minutosAtras: 700 },
    { de: "empresa", texto: "Claro! Tenho quinta às 15h ou sexta às 10h. Qual fica melhor?", minutosAtras: 690 },
    { de: "cliente", texto: "Confirmado pra quinta às 15h", minutosAtras: 660 },
  ],
  "Camila Nogueira": [
    { de: "cliente", texto: "Oi! Vi o anúncio de vocês, queria saber os valores", minutosAtras: 45 },
  ],
  "Diego Prates": [
    { de: "cliente", texto: "Bom dia", minutosAtras: 300 },
    { de: "empresa", texto: "Bom dia, Diego! Tudo bem?", minutosAtras: 295 },
    { de: "cliente", texto: "Vocês atendem sábado de manhã?", minutosAtras: 290 },
  ],
  "Eduarda Lins": [
    { de: "cliente", texto: "Fechou! Pode mandar o link do pagamento", minutosAtras: 180 },
    { de: "empresa", texto: "Mandei agora, Eduarda. Assim que cair eu já reservo seu horário.", minutosAtras: 175 },
    { de: "cliente", texto: "Paguei agora, mandei o comprovante", minutosAtras: 120 },
  ],
  "Felipe Andrade": [
    { de: "cliente", texto: "Recebi a proposta, obrigado", minutosAtras: 480 },
    { de: "cliente", texto: "Consegue parcelar em quantas vezes?", minutosAtras: 470 },
  ],
  "Gabriela Matos": [
    { de: "cliente", texto: "Preenchi o formulário no site de vocês", minutosAtras: 1200 },
    { de: "empresa", texto: "Recebemos sim, Gabriela! Vi que você tem interesse no pacote facial.", minutosAtras: 1190 },
    { de: "cliente", texto: "Pode me mandar mais detalhes por favor", minutosAtras: 1180 },
  ],
  "Henrique Salles": [
    { de: "cliente", texto: "Bom dia, vocês ficam em qual endereço?", minutosAtras: 90 },
  ],
  "Isabela Duarte": [
    { de: "cliente", texto: "Oi, consigo remarcar minha avaliação?", minutosAtras: 2000 },
    { de: "empresa", texto: "Claro, Isabela! Tenho terça às 14h ou quarta às 16h.", minutosAtras: 1990 },
    { de: "cliente", texto: "Perfeito, até terça então", minutosAtras: 1980 },
  ],
  "Juliana Peixoto": [
    { de: "empresa", texto: "Oi Juliana! Como você ficou depois da última sessão?", minutosAtras: 4400 },
    { de: "cliente", texto: "Adorei o resultado, já indiquei pra duas amigas", minutosAtras: 4300 },
  ],
  "Marcos Tavares": [
    { de: "cliente", texto: "Oi, queria saber sobre o tratamento", minutosAtras: 5800 },
    { de: "empresa", texto: "Claro, Marcos! Te mando os detalhes e valores agora.", minutosAtras: 5790 },
    { de: "cliente", texto: "Vou pensar e te retorno semana que vem", minutosAtras: 5760 },
  ],
  "Natália Bastos": [
    { de: "cliente", texto: "Oi, tem horário essa semana ainda?", minutosAtras: 20 },
  ],
};

export type TarefaDemo = {
  titulo: string;
  contato: string;
  responsavel: string;
  urgencia: string;
  descricao: string;
  diasAteOVencimento: number;
  concluida: boolean;
};

/**
 * As tarefas. Uma delas vence ontem de propósito: tarefa atrasada é o que faz a tela de Tarefas
 * ter o que mostrar, e é o argumento de venda do produto (você não esquece o retorno).
 */
export const TAREFAS_DEMO: TarefaDemo[] = [
  {
    titulo: "Retornar para a Amanda sobre a proposta",
    contato: "Amanda Ribeiro",
    responsavel: "Paula Mendes",
    urgencia: "Alta",
    descricao: "Ela ia conversar com o marido. Já faz um dia.",
    diasAteOVencimento: -1,
    concluida: false,
  },
  {
    titulo: "Confirmar avaliação do Bruno",
    contato: "Bruno Carvalho",
    responsavel: "Rafael Correia",
    urgencia: "Média",
    descricao: "Quinta às 15h. Mandar lembrete na véspera.",
    diasAteOVencimento: 1,
    concluida: false,
  },
  {
    titulo: "Responder a Camila sobre valores",
    contato: "Camila Nogueira",
    responsavel: "Paula Mendes",
    urgencia: "Alta",
    descricao: "Lead novo, veio do anúncio. Responder ainda hoje.",
    diasAteOVencimento: 0,
    concluida: false,
  },
  {
    titulo: "Enviar opções de parcelamento ao Felipe",
    contato: "Felipe Andrade",
    responsavel: "Rafael Correia",
    urgencia: "Alta",
    descricao: "Ele perguntou em quantas vezes dá pra dividir.",
    diasAteOVencimento: 0,
    concluida: false,
  },
  {
    titulo: "Agendar retorno da Juliana",
    contato: "Juliana Peixoto",
    responsavel: "Sofia Queiroz",
    urgencia: "Baixa",
    descricao: "Manutenção em 30 dias.",
    diasAteOVencimento: 7,
    concluida: false,
  },
  {
    titulo: "Enviar comprovante da Eduarda para o financeiro",
    contato: "Eduarda Lins",
    responsavel: "Paula Mendes",
    urgencia: "Média",
    descricao: "Pagamento confirmado.",
    diasAteOVencimento: -2,
    concluida: true,
  },
];

/**
 * Negócios encerrados, que alimentam Motivos de perda e Performance.
 *
 * Sem perda registrada, a tela de Motivos de perda abre vazia, e ela é justamente um dos
 * argumentos mais fortes numa demonstração: mostra que o CRM responde "por que eu não vendi".
 */
export const FECHADOS_DEMO = [
  { nome: "Eduarda Lins", status: "ganho" as const, motivo: null, valor: "R$ 3.600" },
  { nome: "Juliana Peixoto", status: "ganho" as const, motivo: null, valor: "R$ 4.800" },
  { nome: "Renata Vilela", status: "perdido" as const, motivo: "Preço acima do orçamento", valor: "R$ 2.900" },
  { nome: "Otávio Freire", status: "perdido" as const, motivo: "Escolheu concorrente", valor: "R$ 1.700" },
  { nome: "Priscila Amaral", status: "perdido" as const, motivo: "Sem retorno do cliente", valor: "R$ 3.100" },
  { nome: "Thiago Menezes", status: "perdido" as const, motivo: "Preço acima do orçamento", valor: "R$ 2.200" },
];

/** Só o que o vídeo e a venda precisam mostrar. Serve de resumo pra conferência. */
export function resumoDaDemo() {
  return {
    contatos: CONTATOS_DEMO.length,
    conversas: Object.keys(CONVERSAS_DEMO).length,
    mensagens: Object.values(CONVERSAS_DEMO).reduce((soma, msgs) => soma + msgs.length, 0),
    etapas: ETAPAS_DEMO.length,
    tarefas: TAREFAS_DEMO.length,
    fechados: FECHADOS_DEMO.length,
  };
}
