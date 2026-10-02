import {
  TIPOS_LAYOUT,
  condicaoBate,
  type Formulario,
  type PaginaFormulario,
  type PerguntaFormulario,
} from "@/lib/formularios-context";
import { cepValido, cnpjValido, cpfValido, emailValido, telefoneValido } from "@/lib/formularios/documentos";

/**
 * O que quem responde vê, e o que ele precisa responder, nos dois jeitos de mostrar o formulário: completo
 * (página por página) e uma pergunta por vez. As regras ficam aqui, fora da tela, pra os dois conferirem
 * igual e pra serem testadas sem navegador.
 */

/** Campos de uma página que devem aparecer, respeitando `oculta` e `logica` (mostrar_se/ocultar_se). */
export function perguntasVisiveis(pagina: PaginaFormulario, valores: Record<string, string>): PerguntaFormulario[] {
  return pagina.perguntas.filter((p) => {
    if (p.oculta) return false;
    if (!p.logica || p.logica.regras.length === 0) return true;
    if (p.logica.modo === "obrigatorio_se") return true; // sempre visível, só muda obrigatoriedade
    const bateAlgumaRegra = p.logica.regras.some((r) => condicaoBate(r.operador, valores[r.campoId], r.valor));
    return p.logica.modo === "mostrar_se" ? bateAlgumaRegra : !bateAlgumaRegra;
  });
}

export function perguntaEhObrigatoria(pergunta: PerguntaFormulario, valores: Record<string, string>): boolean {
  if (pergunta.obrigatoria) return true;
  if (pergunta.logica?.modo === "obrigatorio_se" && pergunta.logica.regras.length > 0) {
    return pergunta.logica.regras.some((r) => condicaoBate(r.operador, valores[r.campoId], r.valor));
  }
  return false;
}

/** Páginas que devem aparecer, respeitando a condição de exibição de cada uma. */
export function paginasVisiveis(formulario: Formulario, valores: Record<string, string>): PaginaFormulario[] {
  return formulario.paginas.filter((p) => {
    if (!p.condicao) return true;
    return condicaoBate(p.condicao.operador, valores[p.condicao.campoId], p.condicao.valor);
  });
}

/** O que impede de seguir com esta pergunta respondida assim, ou null quando está tudo certo. */
export function erroDaPergunta(pergunta: PerguntaFormulario, valores: Record<string, string>): string | null {
  if (TIPOS_LAYOUT.includes(pergunta.tipo)) return null;
  const valor = valores[pergunta.id]?.trim() ?? "";
  if (perguntaEhObrigatoria(pergunta, valores) && !valor) return "Campo obrigatório.";
  if (valor && pergunta.regex) {
    try {
      if (!new RegExp(pergunta.regex).test(valor)) return "Formato inválido.";
    } catch {
      // Regex configurada errada no construtor. Não trava a resposta do cliente por causa disso.
    }
  }
  // Conferência por tipo (24/09/2026). Antes daqui, CPF e CNPJ eram texto livre: 111.111.111-11
  // passava, e o cliente descobria só quando ligava pro lead. A mensagem diz o que está errado, e
  // não "formato inválido", porque quem está respondendo não montou o formulário.
  if (valor) {
    const erro = erroDoTipo(pergunta.tipo, valor);
    if (erro) return erro;
  }
  return null;
}

function erroDoTipo(tipo: PerguntaFormulario["tipo"], valor: string): string | null {
  switch (tipo) {
    case "cpf":
      return cpfValido(valor) ? null : "Esse CPF não existe. Confira os números.";
    case "cnpj":
      return cnpjValido(valor) ? null : "Esse CNPJ não existe. Confira os números.";
    case "cep":
      return cepValido(valor) ? null : "O CEP tem oito números.";
    case "telefone":
      return telefoneValido(valor) ? null : "Coloque o DDD e o número completo.";
    case "email":
      return emailValido(valor) ? null : "Esse e-mail não parece certo.";
    default:
      return null;
  }
}

export type PassoDoFormulario = {
  pagina: PaginaFormulario;
  /** O primeiro passo desta página: é onde o título e a descrição da página aparecem. */
  comecaPagina: boolean;
  /** Títulos, textos, imagens e divisórias que vêm antes da pergunta, na ordem do construtor. */
  blocos: PerguntaFormulario[];
  /** Null só quando o formulário termina com um bloco de texto em vez de pergunta. */
  pergunta: PerguntaFormulario | null;
};

/**
 * Os passos do modo uma pergunta por vez (2026-09-16): uma pergunta por passo, e os blocos que vêm antes
 * dela (título, texto, imagem) aparecem junto. Um título sozinho numa tela, com um OK embaixo, pareceria
 * pergunta sem campo.
 *
 * Recalculados a cada resposta: pergunta que depende de outra (a lógica do construtor) entra ou sai dos
 * passos conforme o que foi respondido, igual ao formulário completo.
 */
export function passosDoFormulario(formulario: Formulario, valores: Record<string, string>): PassoDoFormulario[] {
  const passos: PassoDoFormulario[] = [];
  let blocos: PerguntaFormulario[] = [];
  let paginaAnterior: PaginaFormulario | null = null;
  let ultimaPagina: PaginaFormulario | null = null;

  for (const pagina of paginasVisiveis(formulario, valores)) {
    for (const item of perguntasVisiveis(pagina, valores)) {
      ultimaPagina = pagina;
      if (TIPOS_LAYOUT.includes(item.tipo)) {
        blocos.push(item);
        continue;
      }
      passos.push({ pagina, comecaPagina: pagina !== paginaAnterior, blocos, pergunta: item });
      paginaAnterior = pagina;
      blocos = [];
    }
  }
  // Texto de fechamento depois da última pergunta vira o último passo, só de leitura, com o botão de enviar.
  if (blocos.length > 0 && ultimaPagina) {
    passos.push({ pagina: ultimaPagina, comecaPagina: ultimaPagina !== paginaAnterior, blocos, pergunta: null });
  }
  return passos;
}
