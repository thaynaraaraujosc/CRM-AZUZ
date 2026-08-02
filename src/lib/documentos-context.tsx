"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { currentUser } from "./data";

export type PaginaDoc = {
  id: string;
  conteudoHtml: string;
};

export type ComentarioDoc = {
  id: string;
  trecho: string;
  texto: string;
  autor: string;
  quando: string;
  resolvido: boolean;
  respostas: { autor: string; texto: string; quando: string }[];
};

export type VersaoDoc = {
  id: string;
  quando: string;
  autor: string;
  nome?: string;
  paginas: PaginaDoc[];
};

export type PermissaoAcesso = "visualizar" | "comentar" | "editar";

export type PessoaAcesso = { email: string; permissao: PermissaoAcesso };

export type TamanhoPapel = "A4" | "Carta" | "Ofício" | "Personalizado";
export type OrientacaoPapel = "retrato" | "paisagem";

export type ConfigPagina = {
  tamanho: TamanhoPapel;
  orientacao: OrientacaoPapel;
  /** Margem padrão/legada — usada como valor inicial e como fallback pra documentos salvos antes das margens independentes. */
  margemMm: number;
  /** Margens independentes — cada lado pode ser arrastado/definido sem afetar os outros. Ausentes = usa margemMm (documento antigo). */
  margemSuperiorMm?: number;
  margemInferiorMm?: number;
  margemEsquerdaMm?: number;
  margemDireitaMm?: number;
  corFundo: string;
  /** Colunas de texto (Formatar → Colunas) — 1 = layout normal, sem colunas. */
  colunas: number;
  colunasEspacoMm: number;
  colunasLinha: boolean;
};

export type Documento = {
  id: string;
  titulo: string;
  favorito: boolean;
  criadoEm: string;
  atualizadoEm: string;
  autor: string;
  paginas: PaginaDoc[];
  config: ConfigPagina;
  pessoasAcesso: PessoaAcesso[];
  linkAtivo: boolean;
  linkPermissao: PermissaoAcesso;
  comentarios: ComentarioDoc[];
  versoes: VersaoDoc[];
  excluido: boolean;
};

export const CONFIG_PAGINA_PADRAO: ConfigPagina = {
  tamanho: "A4",
  orientacao: "retrato",
  margemMm: 20,
  corFundo: "#ffffff",
  colunas: 1,
  colunasEspacoMm: 10,
  colunasLinha: false,
};

export type ModeloDocumento = {
  id: string;
  nome: string;
  descricao: string;
  conteudoHtml: string;
};

const CAPA = (cor: string, corTexto: string, titulo: string, subtitulo: string) => `
<div style="background:${cor};color:${corTexto};padding:56px 48px;margin:-1px -1px 28px -1px;border-radius:2px;">
  <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin:0 0 18px;">[NOME DA EMPRESA]</p>
  <h1 style="font-size:32px;margin:0 0 10px;">${titulo}</h1>
  <p style="font-size:14px;opacity:.9;margin:0;">${subtitulo}</p>
</div>`;

export const MODELOS_DOCUMENTO: ModeloDocumento[] = [
  { id: "em-branco", nome: "Documento em branco", descricao: "Comece do zero", conteudoHtml: "" },
  {
    id: "ata",
    nome: "Ata de reunião",
    descricao: "Registro formal com tabela de decisões e responsáveis",
    conteudoHtml: `
${CAPA("#0b1533", "#ffffff", "Ata de reunião", "[TÍTULO DO PROJETO]")}
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
  <tr><td style="padding:4px 8px 4px 0;"><b>Data</b></td><td style="padding:4px;">[DATA]</td>
      <td style="padding:4px 8px 4px 24px;"><b>Horário</b></td><td style="padding:4px;">[HORÁRIO]</td></tr>
  <tr><td style="padding:4px 8px 4px 0;"><b>Local</b></td><td style="padding:4px;" colspan="3">[LOCAL OU LINK DA CHAMADA]</td></tr>
</table>
<h3>Participantes</h3>
<p>[RESPONSÁVEL], [NOME], [NOME]</p>
<h3>Objetivo da reunião</h3>
<p>[DESCREVA O OBJETIVO]</p>
<h3>Pauta</h3>
<ol><li>Tópico 1</li><li>Tópico 2</li><li>Tópico 3</li></ol>
<h3>Assuntos discutidos</h3>
<p></p>
<h3>Decisões e responsáveis</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#eaeefa;"><td style="padding:8px;font-weight:700;">Decisão</td><td style="padding:8px;font-weight:700;">Responsável</td><td style="padding:8px;font-weight:700;">Prazo</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:8px;border-top:1px solid #ddd;">[DATA]</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:8px;border-top:1px solid #ddd;">[DATA]</td></tr>
</table>
<h3>Próximos passos</h3>
<p></p>
<p style="margin-top:40px;">_______________________________<br>Assinatura</p>`,
  },
  {
    id: "relatorio",
    nome: "Relatório executivo",
    descricao: "Capa, indicadores em cartões coloridos e tabela de resultados",
    conteudoHtml: `
${CAPA("#0f9d63", "#ffffff", "Relatório executivo", "Período: [DATA]")}
<h3>Resumo executivo</h3>
<p>[DESCREVA O OBJETIVO deste relatório em duas ou três frases.]</p>
<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:16px 0;">
  <tr>
    <td style="background:#e8f6ee;border-radius:8px;padding:14px;width:33%;"><p style="font-size:11px;color:#0f9d63;margin:0 0 4px;text-transform:uppercase;">Indicador 1</p><p style="font-size:22px;font-weight:700;margin:0;">—</p></td>
    <td style="background:#eaf1ff;border-radius:8px;padding:14px;width:33%;"><p style="font-size:11px;color:#2e6bff;margin:0 0 4px;text-transform:uppercase;">Indicador 2</p><p style="font-size:22px;font-weight:700;margin:0;">—</p></td>
    <td style="background:#fff4e5;border-radius:8px;padding:14px;width:33%;"><p style="font-size:11px;color:#c9660a;margin:0 0 4px;text-transform:uppercase;">Indicador 3</p><p style="font-size:22px;font-weight:700;margin:0;">—</p></td>
  </tr>
</table>
<h3>Tabela de resultados</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#e8f6ee;"><td style="padding:8px;font-weight:700;">Métrica</td><td style="padding:8px;font-weight:700;">Meta</td><td style="padding:8px;font-weight:700;">Realizado</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
</table>
<h3>Análise</h3><p></p>
<h3>Conclusões</h3><p></p>
<h3>Recomendações</h3><p></p>
<h3>Plano de ação</h3><p></p>`,
  },
  {
    id: "proposta",
    nome: "Proposta comercial",
    descricao: "Capa colorida, escopo, cronograma e tabela de investimento",
    conteudoHtml: `
${CAPA("#2e6bff", "#ffffff", "Proposta comercial", "Preparado para [NOME DO CLIENTE] · [DATA]")}
<h3>Apresentação</h3>
<p>[DESCREVA O OBJETIVO da proposta e um breve resumo da empresa.]</p>
<h3>Entendimento do projeto</h3>
<p></p>
<h3>Escopo</h3>
<ul><li>Item do escopo 1</li><li>Item do escopo 2</li><li>Item do escopo 3</li></ul>
<h3>Entregáveis</h3>
<p></p>
<h3>Cronograma</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#eaf1ff;"><td style="padding:8px;font-weight:700;">Fase</td><td style="padding:8px;font-weight:700;">Prazo</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">Fase 1</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">Fase 2</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
</table>
<h3>Investimento</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#eaf1ff;"><td style="padding:8px;font-weight:700;">Item</td><td style="padding:8px;font-weight:700;">Valor</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:8px;border-top:2px solid #2e6bff;font-weight:700;">Total</td><td style="padding:8px;border-top:2px solid #2e6bff;font-weight:700;">&nbsp;</td></tr>
</table>
<h3>Condições de pagamento</h3><p></p>
<h3>Validade da proposta</h3><p>Esta proposta é válida até [DATA].</p>
<h3>Próximos passos</h3><p></p>
<p style="margin-top:40px;">_______________________________<br>[NOME DA EMPRESA]</p>`,
  },
  {
    id: "contrato",
    nome: "Contrato de prestação de serviços",
    descricao: "Cláusulas numeradas, assinaturas e aviso de revisão jurídica",
    conteudoHtml: `
<h1 style="text-align:center;font-size:20px;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p style="background:#fff3cd;border-left:3px solid #c9660a;padding:10px 14px;font-size:12px;">
  ⚠️ Este é um modelo — revise com um profissional jurídico antes de usar.
</p>
<p><b>CONTRATANTE:</b> [NOME DO CLIENTE]</p>
<p><b>CONTRATADO:</b> [NOME DA EMPRESA]</p>
<p>As partes acima identificadas celebram o presente contrato, mediante as cláusulas a seguir:</p>
<p><b>Cláusula 1ª — Do objeto.</b> [DESCREVA O OBJETIVO do contrato.]</p>
<p><b>Cláusula 2ª — Das obrigações.</b> </p>
<p><b>Cláusula 3ª — Dos valores e pagamentos.</b> </p>
<p><b>Cláusula 4ª — Da vigência.</b> Este contrato vigora a partir de [DATA].</p>
<p><b>Cláusula 5ª — Da confidencialidade.</b> </p>
<p><b>Cláusula 6ª — Da rescisão.</b> </p>
<p><b>Cláusula 7ª — Disposições gerais.</b> </p>
<p><b>Cláusula 8ª — Do foro.</b> Fica eleito o foro da comarca de [CIDADE].</p>
<p>[LOCAL], [DATA].</p>
<table style="width:100%;margin-top:40px;"><tr>
  <td style="text-align:center;">_______________________________<br>Contratante</td>
  <td style="text-align:center;">_______________________________<br>Contratado</td>
</tr></table>`,
  },
  {
    id: "planejamento",
    nome: "Planejamento de projeto",
    descricao: "Capa, cronograma, riscos e checklist de acompanhamento",
    conteudoHtml: `
${CAPA("#8a3ffc", "#ffffff", "Planejamento de projeto", "[TÍTULO DO PROJETO]")}
<h3>Visão geral</h3><p></p>
<h3>Objetivos</h3><p></p>
<h3>Escopo</h3><p></p>
<h3>Fases e cronograma</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#f1e9ff;"><td style="padding:8px;font-weight:700;">Fase</td><td style="padding:8px;font-weight:700;">Responsável</td><td style="padding:8px;font-weight:700;">Prazo</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:8px;border-top:1px solid #ddd;">[DATA]</td></tr>
</table>
<h3>Marcos importantes</h3><p></p>
<h3>Riscos</h3><p></p>
<h3>Orçamento</h3><p></p>
<h3>Checklist de acompanhamento</h3>
<p>☐ Item 1<br>☐ Item 2<br>☐ Item 3</p>`,
  },
  {
    id: "curriculo",
    nome: "Currículo profissional",
    descricao: "Layout com coluna lateral colorida",
    conteudoHtml: `
<table style="width:100%;border-collapse:collapse;">
<tr>
<td style="width:32%;background:#0b1533;color:#fff;padding:24px;vertical-align:top;">
  <p style="font-size:11px;letter-spacing:1px;opacity:.7;text-transform:uppercase;margin:0 0 4px;">Contato</p>
  <p style="font-size:12px;margin:0 0 16px;">[E-MAIL]<br>[TELEFONE]<br>[CIDADE]</p>
  <p style="font-size:11px;letter-spacing:1px;opacity:.7;text-transform:uppercase;margin:0 0 4px;">Competências</p>
  <p style="font-size:12px;margin:0 0 16px;">Competência 1<br>Competência 2<br>Competência 3</p>
  <p style="font-size:11px;letter-spacing:1px;opacity:.7;text-transform:uppercase;margin:0 0 4px;">Idiomas</p>
  <p style="font-size:12px;margin:0;">Português — nativo<br>Inglês — intermediário</p>
</td>
<td style="padding:24px;vertical-align:top;">
  <h1 style="margin:0 0 2px;font-size:24px;">[NOME COMPLETO]</h1>
  <p style="color:#2e6bff;font-weight:700;margin:0 0 16px;">[CARGO DESEJADO]</p>
  <h3>Resumo profissional</h3><p>[DESCREVA O OBJETIVO profissional em 2-3 frases.]</p>
  <h3>Experiência</h3>
  <p><b>[CARGO] — [EMPRESA]</b> · [DATA]<br>Descrição das responsabilidades e resultados.</p>
  <h3>Formação</h3>
  <p><b>[CURSO]</b> — [INSTITUIÇÃO] · [DATA]</p>
  <h3>Certificações</h3><p></p>
</td>
</tr>
</table>`,
  },
  {
    id: "orcamento",
    nome: "Orçamento",
    descricao: "Tabela de itens, totais e condições — visual de nota comercial",
    conteudoHtml: `
${CAPA("#c9660a", "#ffffff", "Orçamento", "Nº [NÚMERO] · Emitido em [DATA]")}
<table style="width:100%;font-size:13px;margin-bottom:16px;">
  <tr><td><b>Cliente:</b> [NOME DO CLIENTE]</td><td><b>Validade:</b> [DATA]</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#fff4e5;"><td style="padding:8px;font-weight:700;">Item</td><td style="padding:8px;font-weight:700;">Qtd.</td><td style="padding:8px;font-weight:700;">Valor unitário</td><td style="padding:8px;font-weight:700;">Total</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td colspan="3" style="padding:8px;border-top:2px solid #c9660a;font-weight:700;text-align:right;">Total</td><td style="padding:8px;border-top:2px solid #c9660a;font-weight:700;">R$ —</td></tr>
</table>
<h3>Condições de pagamento</h3><p></p>
<h3>Observações</h3><p></p>
<p style="margin-top:32px;">_______________________________<br>Aceite do cliente</p>`,
  },
  {
    id: "plano-acao",
    nome: "Plano de ação (5W2H)",
    descricao: "Tabela 5W2H com prioridades e status coloridos",
    conteudoHtml: `
${CAPA("#d64545", "#ffffff", "Plano de ação", "[TÍTULO DO PROJETO]")}
<h3>Objetivo principal</h3><p>[DESCREVA O OBJETIVO]</p>
<h3>Cenário atual</h3><p></p>
<h3>5W2H</h3>
<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
  <tr style="background:#fbe4e4;">
    <td style="padding:6px;font-weight:700;">O quê</td><td style="padding:6px;font-weight:700;">Por quê</td>
    <td style="padding:6px;font-weight:700;">Quem</td><td style="padding:6px;font-weight:700;">Quando</td>
    <td style="padding:6px;font-weight:700;">Status</td>
  </tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;color:#0f9d63;">● Em dia</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;color:#d64545;">● Atrasado</td></tr>
</table>
<h3>Indicadores</h3><p></p>`,
  },
  {
    id: "carta",
    nome: "Carta ou comunicado",
    descricao: "Cabeçalho institucional, corpo e assinatura",
    conteudoHtml: `
<p style="text-align:right;">[CIDADE], [DATA].</p>
<p></p>
<p><b>Para:</b> [NOME DO CLIENTE]</p>
<p><b>Assunto:</b> [DESCREVA O OBJETIVO deste comunicado]</p>
<p></p>
<p>Prezado(a),</p>
<p></p>
<p></p>
<p>Atenciosamente,</p>
<p><b>[RESPONSÁVEL]</b><br>[NOME DA EMPRESA]</p>`,
  },
  {
    id: "rascunho-email",
    nome: "Rascunho de e-mail",
    descricao: "Comece um e-mail mais longo por aqui",
    conteudoHtml: "<p>Assunto: </p><p></p><p>Olá,</p><p></p>",
  },
  {
    id: "pauta",
    nome: "Pauta de reunião",
    descricao: "Agenda com horários e tópicos prioritários",
    conteudoHtml: `
<h1>Pauta de reunião</h1>
<p><b>Data:</b> [DATA] &nbsp; <b>Participantes:</b> [RESPONSÁVEL], [NOME]</p>
<h3>Objetivo</h3><p>[DESCREVA O OBJETIVO]</p>
<h3>Agenda</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#eaeefa;"><td style="padding:6px;font-weight:700;">Horário</td><td style="padding:6px;font-weight:700;">Tópico</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">Tópico prioritário 1</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">Tópico prioritário 2</td></tr>
</table>
<h3>Anotações</h3><p></p>
<h3>Decisões necessárias</h3><p></p>
<h3>Pendências</h3><p></p>
<h3>Próxima reunião</h3><p>[DATA]</p>`,
  },
];

type DocumentosContextValue = {
  documentos: Documento[];
  criarDocumento: (titulo?: string, modeloId?: string) => string;
  excluirDocumento: (id: string) => void;
  restaurarDocumento: (id: string) => void;
  excluirPermanente: (id: string) => void;
  esvaziarLixeira: () => void;
  duplicarDocumento: (id: string) => string;
  renomearDocumento: (id: string, titulo: string) => void;
  favoritarDocumento: (id: string) => void;
  atualizarPaginas: (id: string, paginas: PaginaDoc[]) => void;
  adicionarPagina: (id: string) => void;
  removerPagina: (id: string, paginaId: string) => void;
  atualizarConfigPagina: (id: string, patch: Partial<ConfigPagina>) => void;
  adicionarComentario: (id: string, trecho: string, texto: string) => void;
  responderComentario: (id: string, comentarioId: string, texto: string) => void;
  resolverComentario: (id: string, comentarioId: string) => void;
  salvarVersao: (id: string, nome?: string) => void;
  restaurarVersao: (id: string, versaoId: string) => void;
  atualizarAcesso: (
    id: string,
    patch: Partial<Pick<Documento, "pessoasAcesso" | "linkAtivo" | "linkPermissao">>,
  ) => void;
};

const DocumentosContext = createContext<DocumentosContextValue | null>(null);

export const DOCUMENTOS_STORAGE_KEY = "azuz-crm-documentos";

function agora() {
  return new Date().toISOString();
}

function idUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Datas fixas (não `agora()`) — esse array é avaliado no carregamento do módulo, tanto no
 * servidor quanto no cliente, em instantes diferentes; usar `new Date()` aqui causaria
 * hydration mismatch (o texto da data renderizada no servidor não bateria com o do cliente).
 */
const DOCUMENTOS_INICIAIS: Documento[] = [
  {
    id: "doc-1",
    titulo: "Sem título",
    favorito: false,
    criadoEm: "2026-01-05T09:00:00.000Z",
    atualizadoEm: "2026-01-05T09:00:00.000Z",
    autor: currentUser.name,
    paginas: [{ id: "pagina-1", conteudoHtml: "" }],
    config: CONFIG_PAGINA_PADRAO,
    pessoasAcesso: [],
    linkAtivo: false,
    linkPermissao: "visualizar",
    comentarios: [],
    versoes: [],
    excluido: false,
  },
];

export function DocumentosProvider({ children }: { children: ReactNode }) {
  const [documentos, setDocumentos] = useState<Documento[]>(() => {
    if (typeof window === "undefined") return DOCUMENTOS_INICIAIS;
    try {
      const salvos = localStorage.getItem(DOCUMENTOS_STORAGE_KEY);
      return salvos ? (JSON.parse(salvos) as Documento[]) : DOCUMENTOS_INICIAIS;
    } catch {
      return DOCUMENTOS_INICIAIS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DOCUMENTOS_STORAGE_KEY, JSON.stringify(documentos));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [documentos]);

  function criarDocumento(titulo?: string, modeloId?: string) {
    const id = idUnico("doc");
    const modelo = MODELOS_DOCUMENTO.find((m) => m.id === modeloId);
    const novo: Documento = {
      id,
      titulo: titulo?.trim() || "Sem título",
      favorito: false,
      criadoEm: agora(),
      atualizadoEm: agora(),
      autor: currentUser.name,
      paginas: [{ id: idUnico("pagina"), conteudoHtml: modelo?.conteudoHtml ?? "" }],
      config: CONFIG_PAGINA_PADRAO,
      pessoasAcesso: [],
      linkAtivo: false,
      linkPermissao: "visualizar",
      comentarios: [],
      versoes: [],
      excluido: false,
    };
    setDocumentos((prev) => [novo, ...prev]);
    return id;
  }

  function atualizarDocumento(id: string, patch: Partial<Documento>) {
    setDocumentos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, atualizadoEm: agora() } : d)),
    );
  }

  function excluirDocumento(id: string) {
    atualizarDocumento(id, { excluido: true });
  }

  function restaurarDocumento(id: string) {
    atualizarDocumento(id, { excluido: false });
  }

  function excluirPermanente(id: string) {
    setDocumentos((prev) => prev.filter((d) => d.id !== id));
  }

  function esvaziarLixeira() {
    setDocumentos((prev) => prev.filter((d) => !d.excluido));
  }

  function duplicarDocumento(id: string) {
    const original = documentos.find((d) => d.id === id);
    const novoId = idUnico("doc");
    if (!original) return novoId;
    const copia: Documento = {
      ...original,
      id: novoId,
      titulo: `Cópia de ${original.titulo}`,
      criadoEm: agora(),
      atualizadoEm: agora(),
      comentarios: [],
      versoes: [],
      excluido: false,
    };
    setDocumentos((prev) => [copia, ...prev]);
    return novoId;
  }

  function renomearDocumento(id: string, titulo: string) {
    atualizarDocumento(id, { titulo: titulo.trim() || "Sem título" });
  }

  function favoritarDocumento(id: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, { favorito: !doc.favorito });
  }

  function atualizarPaginas(id: string, paginas: PaginaDoc[]) {
    atualizarDocumento(id, { paginas });
  }

  function adicionarPagina(id: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      paginas: [...doc.paginas, { id: idUnico("pagina"), conteudoHtml: "" }],
    });
  }

  function removerPagina(id: string, paginaId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc || doc.paginas.length <= 1) return;
    atualizarDocumento(id, { paginas: doc.paginas.filter((p) => p.id !== paginaId) });
  }

  function atualizarConfigPagina(id: string, patch: Partial<ConfigPagina>) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, { config: { ...doc.config, ...patch } });
  }

  function adicionarComentario(id: string, trecho: string, texto: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const comentario: ComentarioDoc = {
      id: idUnico("comentario"),
      trecho,
      texto,
      autor: currentUser.name,
      quando: agora(),
      resolvido: false,
      respostas: [],
    };
    atualizarDocumento(id, { comentarios: [...doc.comentarios, comentario] });
  }

  function responderComentario(id: string, comentarioId: string, texto: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      comentarios: doc.comentarios.map((c) =>
        c.id === comentarioId
          ? {
              ...c,
              respostas: [...c.respostas, { autor: currentUser.name, texto, quando: agora() }],
            }
          : c,
      ),
    });
  }

  function resolverComentario(id: string, comentarioId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    atualizarDocumento(id, {
      comentarios: doc.comentarios.map((c) =>
        c.id === comentarioId ? { ...c, resolvido: !c.resolvido } : c,
      ),
    });
  }

  function salvarVersao(id: string, nome?: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const versao: VersaoDoc = {
      id: idUnico("versao"),
      quando: agora(),
      autor: currentUser.name,
      nome,
      paginas: doc.paginas,
    };
    atualizarDocumento(id, { versoes: [...doc.versoes, versao] });
  }

  function restaurarVersao(id: string, versaoId: string) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    const versao = doc.versoes.find((v) => v.id === versaoId);
    if (!versao) return;
    atualizarDocumento(id, { paginas: versao.paginas });
  }

  function atualizarAcesso(
    id: string,
    patch: Partial<Pick<Documento, "pessoasAcesso" | "linkAtivo" | "linkPermissao">>,
  ) {
    atualizarDocumento(id, patch);
  }

  return (
    <DocumentosContext.Provider
      value={{
        documentos,
        criarDocumento,
        excluirDocumento,
        restaurarDocumento,
        excluirPermanente,
        esvaziarLixeira,
        duplicarDocumento,
        renomearDocumento,
        favoritarDocumento,
        atualizarPaginas,
        adicionarPagina,
        removerPagina,
        atualizarConfigPagina,
        adicionarComentario,
        responderComentario,
        resolverComentario,
        salvarVersao,
        restaurarVersao,
        atualizarAcesso,
      }}
    >
      {children}
    </DocumentosContext.Provider>
  );
}

export function useDocumentos() {
  const ctx = useContext(DocumentosContext);
  if (!ctx) throw new Error("useDocumentos precisa estar dentro de DocumentosProvider");
  return ctx;
}
