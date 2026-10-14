import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * A validação do que o AZUZ Flow manda. Pura de propósito: é a parte que decide o que entra no CRM
 * de um cliente a partir de uma chamada de fora, e é a que mais precisa de teste. Sem banco aqui,
 * nenhum import que puxe Prisma.
 *
 * A REGRA GERAL É CORTAR, NÃO RECUSAR. Um lead chega uma vez: se a pessoa escreveu um "cargo" de
 * 400 caracteres, recusar a entrega inteira perde o lead de verdade por causa de um campo que
 * ninguém vai ler até o fim. Então todo texto é aparado e truncado, e só o que torna o lead
 * inutilizável (nenhuma forma de identificar a pessoa) vira 400.
 */

export const LIMITES = {
  corpoBytes: 64 * 1024,
  nome: 120,
  email: 190,
  campo: 200,
  respostas: 60,
  pergunta: 200,
  resposta: 2000,
  consentimentoTexto: 2000,
  link: 500,
} as const;

export type RespostaDoFormulario = { pergunta: string; resposta: string };

/** A reunião que a pessoa escolheu no campo "Agendar reunião" do formulário. */
export type ReuniaoDoFlow = {
  /** Instante em UTC. A conversão pro fuso de Brasília é feita na hora de gravar. */
  inicio: Date;
  fim: Date | null;
  link: string | null;
};

export type LeadDoFlow = {
  formularioId: string;
  formularioNome: string;
  respostaId: string;
  recebidaEm: Date | null;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
  /** Já normalizado (dígitos, DDI, 9º dígito). `null` quando ausente ou inválido. */
  whatsapp: string | null;
  empresa: string | null;
  cargo: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  endereco: string | null;
  respostas: RespostaDoFormulario[];
  consentimentoWhatsApp: boolean;
  consentimentoTexto: string | null;
  consentimentoEm: Date | null;
  /** `null` quando o formulário não tem agendamento, ou quando o que veio era inválido. */
  reuniao: ReuniaoDoFlow | null;
  /** O nome-chave sugerido pro contato, pelas regras do contrato. */
  nomeDoContato: string;
  avisos: string[];
};

export type ResultadoDaValidacao =
  | { ok: true; lead: LeadDoFlow }
  | { ok: false; erro: string };

/**
 * Tira caractere de controle, apara e corta no limite.
 *
 * O controle sai porque o texto vai pra tela, pro corpo de uma mensagem de WhatsApp e pro nome de
 * um contato: um `\u0000` no meio quebra comparação de string em banco, e um `\r` solto vira linha
 * fantasma na bolha. Nada aqui vira HTML em lugar nenhum — o CRM desenha tudo como texto —, então
 * não há escape de HTML a fazer, e fazê-lo aqui só esconderia `<` de um nome legítimo.
 */
function limpar(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const semControle = valor.replace(/[\u0000-\u001F\u007F]/g, " ");
  const aparado = semControle.replace(/\s+/g, " ").trim();
  if (!aparado) return null;
  return aparado.slice(0, limite);
}

function dataValida(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Link de reunião só vale se for http(s).
 *
 * O `local` do compromisso aparece na tela e pode virar parâmetro de modelo oficial. Aceitar
 * `javascript:` ou `data:` aqui seria plantar, pelo que um formulário de fora manda, um link que o
 * navegador executa. `new URL` também recusa texto que não é endereço nenhum.
 */
function linkValido(valor: unknown): string | null {
  const texto = limpar(valor, LIMITES.link);
  if (!texto) return null;
  try {
    const url = new URL(texto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return texto;
  } catch {
    return null;
  }
}

/**
 * Lê o campo `reuniao`, que é opcional.
 *
 * Nunca devolve erro: um horário ilegível não pode custar o lead inteiro, porque o lead chega uma
 * vez só e o nome e o WhatsApp continuam bons. O que não dá pra entender vira aviso.
 */
function lerReuniao(bruto: unknown, avisos: string[]): ReuniaoDoFlow | null {
  if (bruto === undefined || bruto === null) return null;
  if (typeof bruto !== "object" || Array.isArray(bruto)) {
    avisos.push("O campo `reuniao` não era um objeto; o lead entrou sem reunião agendada.");
    return null;
  }
  const campo = bruto as Record<string, unknown>;

  const inicio = dataValida(campo.inicio);
  if (!inicio) {
    avisos.push("A data de início da reunião não pôde ser lida; o lead entrou sem reunião agendada.");
    return null;
  }

  // Fim antes do início é dado incoerente: guardar inverteria a duração na agenda. Como `fim` é
  // opcional no contrato, descartar só ele preserva a reunião, que é o que importa.
  let fim = dataValida(campo.fim);
  if (fim && fim.getTime() <= inicio.getTime()) {
    avisos.push("O fim da reunião não era depois do início; a reunião entrou sem horário de término.");
    fim = null;
  }

  const link = linkValido(campo.link);
  if (!link && campo.link !== undefined && campo.link !== null) {
    avisos.push("O link da reunião não era um endereço http(s) válido; a reunião entrou sem link.");
  }

  return { inicio, fim, link };
}

/** Os 4 últimos dígitos, pro nome de quem só mandou telefone. */
function ultimos4(telefone: string): string {
  return telefone.slice(-4);
}

export function validarPayloadDoFlow(bruto: unknown): ResultadoDaValidacao {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, erro: "O corpo da requisição precisa ser um objeto JSON." };
  }
  const corpo = bruto as Record<string, unknown>;

  const origem = (corpo.origem ?? {}) as Record<string, unknown>;
  const lead = (corpo.lead ?? {}) as Record<string, unknown>;
  const consentimento = (corpo.consentimento ?? {}) as Record<string, unknown>;
  const consentimentoWa = (consentimento.whatsapp ?? {}) as Record<string, unknown>;

  const respostaId = limpar(origem.respostaId, 100);
  if (!respostaId) {
    return { ok: false, erro: "Falta `origem.respostaId`, que é o identificador da entrega." };
  }
  const formularioId = limpar(origem.formularioId, LIMITES.campo) ?? "";
  const formularioNome = limpar(origem.formularioNome, LIMITES.nome) ?? "Formulário";

  // Booleano de verdade, não "verdadeiro se parecer verdadeiro": `"false"` (string) é um erro de
  // quem integra, e aceitá-lo como `true` gravaria consentimento que a pessoa não deu.
  if (typeof consentimentoWa.aceitou !== "boolean") {
    return {
      ok: false,
      erro: "Falta `consentimento.whatsapp.aceitou` (true ou false). Mande `false` quando o formulário não tem a caixa de WhatsApp.",
    };
  }

  const avisos: string[] = [];

  const nome = limpar(lead.nome, LIMITES.nome);
  const sobrenome = limpar(lead.sobrenome, LIMITES.nome);
  const emailBruto = limpar(lead.email, LIMITES.email);
  const email = emailBruto ? emailBruto.toLowerCase() : null;

  const whatsappBruto = limpar(lead.whatsapp, 40);
  let whatsapp: string | null = null;
  if (whatsappBruto) {
    const normalizado = normalizarTelefoneParaComparacao(whatsappBruto);
    // Curto demais pra ser telefone: aceitar criaria uma conversa apontando pra um número que não
    // existe, e o erro só apareceria quando a Meta recusasse o envio, longe daqui.
    if (normalizado.length >= 10) {
      whatsapp = normalizado;
    } else {
      avisos.push("O WhatsApp informado não parece um número válido; o lead entrou sem WhatsApp.");
    }
  }

  if (!nome && !email && !whatsapp) {
    return { ok: false, erro: "O lead não traz nome, e-mail nem WhatsApp." };
  }

  const respostasBrutas = Array.isArray(corpo.respostas) ? corpo.respostas : [];
  if (respostasBrutas.length > LIMITES.respostas) {
    avisos.push(`O formulário mandou ${respostasBrutas.length} respostas; guardamos as ${LIMITES.respostas} primeiras.`);
  }
  const respostas: RespostaDoFormulario[] = [];
  for (const item of respostasBrutas.slice(0, LIMITES.respostas)) {
    if (!item || typeof item !== "object") continue;
    const linha = item as Record<string, unknown>;
    const pergunta = limpar(linha.pergunta, LIMITES.pergunta);
    const resposta = limpar(linha.resposta, LIMITES.resposta);
    if (pergunta || resposta) respostas.push({ pergunta: pergunta ?? "", resposta: resposta ?? "" });
  }

  /*
   * O NOME-CHAVE DO CONTATO.
   *
   * No CRM o contato é identificado pelo nome (`@@unique([workspaceId, nome])`), e conversa,
   * mensagem e card se amarram a ele. Então o nome não é enfeite: é a chave. A ordem abaixo é a do
   * contrato, e cada degrau existe porque o anterior pode faltar.
   */
  const reuniao = lerReuniao(corpo.reuniao, avisos);

  const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim();
  const nomeDoContato =
    nomeCompleto ||
    (email ? (email.split("@")[0] ?? "").trim() : "") ||
    (whatsapp ? `Lead ${ultimos4(whatsapp)}` : "");

  if (!nomeDoContato) {
    return { ok: false, erro: "Não foi possível montar um nome pro contato a partir do que veio." };
  }

  return {
    ok: true,
    lead: {
      formularioId,
      formularioNome,
      respostaId,
      recebidaEm: dataValida(origem.recebidaEm),
      nome,
      sobrenome,
      email,
      whatsapp,
      empresa: limpar(lead.empresa, LIMITES.campo),
      cargo: limpar(lead.cargo, LIMITES.campo),
      cidade: limpar(lead.cidade, LIMITES.campo),
      estado: limpar(lead.estado, LIMITES.campo),
      pais: limpar(lead.pais, LIMITES.campo),
      endereco: limpar(lead.endereco, LIMITES.campo),
      respostas,
      consentimentoWhatsApp: consentimentoWa.aceitou,
      consentimentoTexto: limpar(consentimentoWa.texto, LIMITES.consentimentoTexto),
      consentimentoEm: dataValida(consentimentoWa.em),
      reuniao,
      nomeDoContato: nomeDoContato.slice(0, LIMITES.nome),
      avisos,
    },
  };
}
