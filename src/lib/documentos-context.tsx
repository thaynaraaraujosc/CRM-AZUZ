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
  /** Cabeçalho e rodapé — o mesmo conteúdo se repete em todas as páginas (não é por página). Suporta os
   * tokens de texto {{PAGINA}} e {{TOTAL}}, substituídos pelo número real de cada página na hora de
   * renderizar, imprimir e exportar. Vazio = sem cabeçalho/rodapé (comportamento anterior, sem mudança). */
  cabecalhoHtml?: string;
  rodapeHtml?: string;
  /** Posições de tabulação (mm a partir da margem esquerda), mostradas na régua horizontal — ver ReguaDocumento. */
  tabulacoesMm?: number[];
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

export type CategoriaModelo =
  | "Negócios"
  | "Vendas"
  | "Marketing"
  | "Saúde"
  | "Recursos Humanos"
  | "Jurídico"
  | "Financeiro"
  | "Educação"
  | "Planejamento"
  | "Relatórios"
  | "Comunicação"
  | "Documentos pessoais";

export type ModeloDocumento = {
  id: string;
  nome: string;
  descricao: string;
  categoria: CategoriaModelo;
  conteudoHtml: string;
};

const CAPA = (cor: string, corTexto: string, titulo: string, subtitulo: string) => `
<div style="background:${cor};color:${corTexto};padding:56px 48px;margin:-1px -1px 28px -1px;border-radius:2px;">
  <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin:0 0 18px;">[NOME DA EMPRESA]</p>
  <h1 style="font-size:32px;margin:0 0 10px;">${titulo}</h1>
  <p style="font-size:14px;opacity:.9;margin:0;">${subtitulo}</p>
</div>`;

export const MODELOS_DOCUMENTO: ModeloDocumento[] = [
  { id: "em-branco", nome: "Documento em branco", descricao: "Página limpa em A4, margens equilibradas, estilo básico", categoria: "Documentos pessoais", conteudoHtml: "" },
  {
    id: "ata",
    nome: "Ata de reunião",
    descricao: "Registro formal com tabela de decisões e responsáveis",
    categoria: "Negócios",
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
    categoria: "Relatórios",
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
<h3>Gráfico de desempenho</h3>
<svg width="100%" height="140" viewBox="0 0 400 140" style="background:#fafafa;border-radius:8px;">
  <line x1="30" y1="10" x2="30" y2="120" stroke="#ccc"/>
  <line x1="30" y1="120" x2="380" y2="120" stroke="#ccc"/>
  <rect x="55" y="60" width="40" height="60" fill="#0f9d63"/>
  <rect x="135" y="35" width="40" height="85" fill="#2e6bff"/>
  <rect x="215" y="70" width="40" height="50" fill="#c9660a"/>
  <rect x="295" y="20" width="40" height="100" fill="#8a3ffc"/>
  <text x="75" y="134" font-size="11" text-anchor="middle" fill="#666">Jan</text>
  <text x="155" y="134" font-size="11" text-anchor="middle" fill="#666">Fev</text>
  <text x="235" y="134" font-size="11" text-anchor="middle" fill="#666">Mar</text>
  <text x="315" y="134" font-size="11" text-anchor="middle" fill="#666">Abr</text>
</svg>
<h3>Análise</h3><p></p>
<h3>Conclusões</h3><p></p>
<h3>Recomendações</h3><p></p>
<h3>Plano de ação</h3><p></p>`,
  },
  {
    id: "proposta",
    nome: "Proposta comercial",
    descricao: "Capa colorida, escopo, cronograma e tabela de investimento",
    categoria: "Vendas",
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
    categoria: "Jurídico",
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
    categoria: "Planejamento",
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
    categoria: "Documentos pessoais",
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
    categoria: "Financeiro",
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
    categoria: "Planejamento",
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
    categoria: "Comunicação",
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
    categoria: "Comunicação",
    conteudoHtml: "<p>Assunto: </p><p></p><p>Olá,</p><p></p>",
  },
  {
    id: "pauta",
    nome: "Pauta de reunião",
    descricao: "Agenda com horários e tópicos prioritários",
    categoria: "Negócios",
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
  {
    id: "marketing",
    nome: "Plano de marketing",
    descricao: "Capa moderna, personas, canais e calendário de conteúdo",
    categoria: "Marketing",
    conteudoHtml: `
${CAPA("#ff5c8a", "#ffffff", "Plano de marketing", "[TÍTULO DO PROJETO] · [DATA]")}
<h3>Estratégia</h3><p>[DESCREVA O OBJETIVO da estratégia de marketing.]</p>
<h3>Público-alvo e personas</h3>
<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:16px 0;">
  <tr>
    <td style="background:#ffeaf1;border-radius:8px;padding:14px;width:50%;"><p style="font-size:11px;color:#ff5c8a;margin:0 0 4px;text-transform:uppercase;">Persona 1</p><p style="font-size:13px;margin:0;">[NOME], idade, cargo, dores e objetivos.</p></td>
    <td style="background:#eaf1ff;border-radius:8px;padding:14px;width:50%;"><p style="font-size:11px;color:#2e6bff;margin:0 0 4px;text-transform:uppercase;">Persona 2</p><p style="font-size:13px;margin:0;">[NOME], idade, cargo, dores e objetivos.</p></td>
  </tr>
</table>
<h3>Posicionamento</h3><p></p>
<h3>Canais</h3>
<p>☐ Redes sociais &nbsp; ☐ E-mail marketing &nbsp; ☐ Anúncios pagos &nbsp; ☐ SEO/conteúdo &nbsp; ☐ Parcerias</p>
<h3>Calendário (visão geral)</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#ffeaf1;"><td style="padding:8px;font-weight:700;">Semana</td><td style="padding:8px;font-weight:700;">Canal</td><td style="padding:8px;font-weight:700;">Ação</td><td style="padding:8px;font-weight:700;">Responsável</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td></tr>
</table>
<h3>Orçamento</h3><p></p>
<h3>Indicadores de sucesso</h3><p></p>`,
  },
  {
    id: "calendario-editorial",
    nome: "Calendário editorial",
    descricao: "Grade mensal colorida por canal, com status de cada publicação",
    categoria: "Marketing",
    conteudoHtml: `
${CAPA("#8a3ffc", "#ffffff", "Calendário editorial", "[MÊS/ANO]")}
<h3>Linha editorial</h3><p>[DESCREVA O OBJETIVO do conteúdo deste período.]</p>
<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
  <tr style="background:#f1e9ff;">
    <td style="padding:6px;font-weight:700;">Data</td><td style="padding:6px;font-weight:700;">Canal</td>
    <td style="padding:6px;font-weight:700;">Tema/Título</td><td style="padding:6px;font-weight:700;">Formato</td>
    <td style="padding:6px;font-weight:700;">Responsável</td><td style="padding:6px;font-weight:700;">Status</td>
  </tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;">Instagram</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">Post</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;color:#0f9d63;">● Publicado</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;">Blog</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">Artigo</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;color:#c9660a;">● Em produção</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;">E-mail</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">Newsletter</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;color:#2e6bff;">● Planejado</td></tr>
</table>
<h3>Datas comemorativas do período</h3><p></p>
<h3>Observações</h3><p></p>`,
  },
  {
    id: "fatura",
    nome: "Fatura ou recibo",
    descricao: "Layout formal e limpo, pronto para cobrança",
    categoria: "Financeiro",
    conteudoHtml: `
<table style="width:100%;margin-bottom:24px;"><tr>
  <td><h1 style="margin:0;font-size:22px;">[NOME DA EMPRESA]</h1><p style="font-size:12px;color:#666;margin:2px 0 0;">[CNPJ] · [E-MAIL] · [TELEFONE]</p></td>
  <td style="text-align:right;"><p style="font-size:20px;font-weight:700;margin:0;color:#0b1533;">FATURA</p><p style="font-size:12px;color:#666;margin:2px 0 0;">Nº [NÚMERO] · [DATA]</p></td>
</tr></table>
<table style="width:100%;background:#f4f6fb;border-radius:8px;padding:14px;font-size:13px;margin-bottom:20px;"><tr>
  <td style="padding:14px;"><b>Cobrar de</b><br>[NOME DO CLIENTE]<br>[ENDEREÇO]</td>
  <td style="padding:14px;"><b>Vencimento</b><br>[DATA]</td>
</tr></table>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#0b1533;color:#fff;"><td style="padding:8px;font-weight:700;">Descrição</td><td style="padding:8px;font-weight:700;">Qtd.</td><td style="padding:8px;font-weight:700;">Valor unit.</td><td style="padding:8px;font-weight:700;">Total</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td colspan="2" style="padding:8px;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">Subtotal</td><td style="padding:8px;border-top:1px solid #ddd;">R$ —</td></tr>
  <tr><td colspan="2" style="padding:8px;">&nbsp;</td><td style="padding:8px;">Impostos</td><td style="padding:8px;">R$ —</td></tr>
  <tr><td colspan="2" style="padding:8px;">&nbsp;</td><td style="padding:8px;border-top:2px solid #0b1533;font-weight:700;">Total</td><td style="padding:8px;border-top:2px solid #0b1533;font-weight:700;">R$ —</td></tr>
</table>
<h3>Forma de pagamento</h3><p></p>
<h3>Observações</h3><p></p>
<p style="font-size:11px;color:#999;margin-top:32px;">Obrigado pela preferência.</p>`,
  },
  {
    id: "atendimento-crm",
    nome: "Relatório de atendimento (CRM)",
    descricao: "Cartões de indicadores e histórico de interações com o cliente",
    categoria: "Relatórios",
    conteudoHtml: `
${CAPA("#0e7c86", "#ffffff", "Relatório de atendimento", "[NOME DO CLIENTE] · Período: [DATA]")}
<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:16px 0;">
  <tr>
    <td style="background:#e6f5f6;border-radius:8px;padding:14px;width:25%;"><p style="font-size:11px;color:#0e7c86;margin:0 0 4px;text-transform:uppercase;">Atendimentos</p><p style="font-size:20px;font-weight:700;margin:0;">—</p></td>
    <td style="background:#eaf1ff;border-radius:8px;padding:14px;width:25%;"><p style="font-size:11px;color:#2e6bff;margin:0 0 4px;text-transform:uppercase;">Tempo médio</p><p style="font-size:20px;font-weight:700;margin:0;">—</p></td>
    <td style="background:#e8f6ee;border-radius:8px;padding:14px;width:25%;"><p style="font-size:11px;color:#0f9d63;margin:0 0 4px;text-transform:uppercase;">Satisfação</p><p style="font-size:20px;font-weight:700;margin:0;">—</p></td>
    <td style="background:#fff4e5;border-radius:8px;padding:14px;width:25%;"><p style="font-size:11px;color:#c9660a;margin:0 0 4px;text-transform:uppercase;">Pendentes</p><p style="font-size:20px;font-weight:700;margin:0;">—</p></td>
  </tr>
</table>
<h3>Histórico de interações</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#e6f5f6;"><td style="padding:8px;font-weight:700;">Data</td><td style="padding:8px;font-weight:700;">Canal</td><td style="padding:8px;font-weight:700;">Assunto</td><td style="padding:8px;font-weight:700;">Responsável</td><td style="padding:8px;font-weight:700;">Status</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:8px;border-top:1px solid #ddd;">WhatsApp</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:8px;border-top:1px solid #ddd;color:#0f9d63;">● Resolvido</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:8px;border-top:1px solid #ddd;">Telefone</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:8px;border-top:1px solid #ddd;color:#d64545;">● Pendente</td></tr>
</table>
<h3>Observações e próximos passos</h3><p></p>`,
  },
  {
    id: "saude",
    nome: "Plano de acompanhamento de saúde",
    descricao: "Layout elegante para metas, hábitos e evolução do paciente",
    categoria: "Saúde",
    conteudoHtml: `
${CAPA("#2f9e8f", "#ffffff", "Plano de acompanhamento de saúde", "[NOME DO CLIENTE] · Início em [DATA]")}
<h3>Objetivo</h3><p>[DESCREVA O OBJETIVO do acompanhamento.]</p>
<h3>Dados gerais</h3>
<table style="width:100%;font-size:13px;margin-bottom:16px;">
  <tr><td style="padding:4px 8px 4px 0;"><b>Idade</b></td><td style="padding:4px;">&nbsp;</td><td style="padding:4px 8px 4px 24px;"><b>Responsável</b></td><td style="padding:4px;">[RESPONSÁVEL]</td></tr>
</table>
<h3>Metas</h3>
<p>☐ Meta 1<br>☐ Meta 2<br>☐ Meta 3</p>
<h3>Plano semanal</h3>
<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
  <tr style="background:#e6f5f2;"><td style="padding:6px;font-weight:700;">Dia</td><td style="padding:6px;font-weight:700;">Atividade</td><td style="padding:6px;font-weight:700;">Observação</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">Segunda</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">Quarta</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">Sexta</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:6px;border-top:1px solid #ddd;">&nbsp;</td></tr>
</table>
<h3>Evolução</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr style="background:#e6f5f2;"><td style="padding:8px;font-weight:700;">Data</td><td style="padding:8px;font-weight:700;">Indicador</td><td style="padding:8px;font-weight:700;">Valor</td><td style="padding:8px;font-weight:700;">Observação</td></tr>
  <tr><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td><td style="padding:8px;border-top:1px solid #ddd;">&nbsp;</td></tr>
</table>
<p style="background:#fff3cd;border-left:3px solid #c9660a;padding:10px 14px;font-size:12px;margin-top:16px;">⚠️ Este modelo é organizacional — não substitui orientação profissional de saúde.</p>`,
  },
  {
    id: "ebook",
    nome: "E-book ou material rico",
    descricao: "Capa criativa, sumário, capítulos e chamada para ação",
    categoria: "Educação",
    conteudoHtml: `
<div style="background:linear-gradient(135deg,#8a3ffc,#2e6bff);color:#fff;padding:80px 48px;margin:-1px -1px 28px -1px;border-radius:2px;text-align:center;">
  <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.85;margin:0 0 20px;">[NOME DA EMPRESA]</p>
  <h1 style="font-size:36px;margin:0 0 12px;">[TÍTULO DO PROJETO]</h1>
  <p style="font-size:15px;opacity:.9;margin:0;">[DESCREVA O OBJETIVO deste material em uma frase.]</p>
</div>
<h3>Sumário</h3>
<p>1. Introdução<br>2. Capítulo 1 — [TÍTULO]<br>3. Capítulo 2 — [TÍTULO]<br>4. Conclusão</p>
<h3>Introdução</h3><p></p>
<h3>Capítulo 1 — [TÍTULO]</h3><p></p>
<blockquote style="border-left:3px solid #8a3ffc;margin:16px 0;padding:8px 16px;font-style:italic;color:#555;background:#f8f6ff;">"Destaque uma citação ou dado importante aqui."</blockquote>
<svg width="100%" height="160" viewBox="0 0 400 160" style="background:#f1e9ff;border-radius:8px;">
  <rect x="140" y="45" width="120" height="80" rx="6" fill="#fff" stroke="#8a3ffc" stroke-width="2"/>
  <circle cx="165" cy="70" r="10" fill="#8a3ffc"/>
  <path d="M148 115 L185 85 L210 105 L235 78 L252 115 Z" fill="#c9b8ff"/>
  <text x="200" y="142" font-size="11" text-anchor="middle" fill="#8a3ffc">[INSIRA UMA IMAGEM]</text>
</svg>
<svg width="100%" height="24" viewBox="0 0 400 24" aria-hidden="true" style="margin:20px 0;">
  <line x1="0" y1="12" x2="170" y2="12" stroke="#ddd"/>
  <circle cx="200" cy="12" r="4" fill="#8a3ffc"/>
  <line x1="230" y1="12" x2="400" y2="12" stroke="#ddd"/>
</svg>
<h3>Capítulo 2 — [TÍTULO]</h3><p></p>
<div style="background:#eaf1ff;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;"><b>💡 Dica:</b> destaque um insight prático pro leitor aqui.</p></div>
<h3>Conclusão</h3><p></p>
<div style="background:#0b1533;color:#fff;border-radius:8px;padding:24px;text-align:center;margin-top:24px;">
  <p style="margin:0 0 8px;font-size:16px;font-weight:700;">Gostou do conteúdo?</p>
  <p style="margin:0;font-size:13px;opacity:.85;">[DESCREVA A CHAMADA PARA AÇÃO — fale com a gente, acesse o site, etc.]</p>
</div>`,
  },
  {
    id: "manual",
    nome: "Manual ou procedimento operacional",
    descricao: "Institucional, com controle de versão e checklist de passos",
    categoria: "Educação",
    conteudoHtml: `
${CAPA("#0b1533", "#ffffff", "[TÍTULO DO PROCEDIMENTO]", "Manual operacional · [NOME DA EMPRESA]")}
<h3>Controle de versão</h3>
<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
  <tr style="background:#eaeefa;"><td style="padding:6px;font-weight:700;">Versão</td><td style="padding:6px;font-weight:700;">Data</td><td style="padding:6px;font-weight:700;">Autor</td><td style="padding:6px;font-weight:700;">Alteração</td></tr>
  <tr><td style="padding:6px;border-top:1px solid #ddd;">1.0</td><td style="padding:6px;border-top:1px solid #ddd;">[DATA]</td><td style="padding:6px;border-top:1px solid #ddd;">[RESPONSÁVEL]</td><td style="padding:6px;border-top:1px solid #ddd;">Criação do documento</td></tr>
</table>
<h3>Objetivo</h3><p>[DESCREVA O OBJETIVO deste procedimento.]</p>
<h3>Área de aplicação</h3><p></p>
<h3>Responsáveis</h3><p>[RESPONSÁVEL]</p>
<h3>Materiais necessários</h3><p></p>
<h3>Passo a passo</h3>
<ol>
  <li>Descreva o primeiro passo.</li>
  <li>Descreva o segundo passo.</li>
  <li>Descreva o terceiro passo.</li>
</ol>
<p style="background:#fff3cd;border-left:3px solid #c9660a;padding:10px 14px;font-size:12px;">⚠️ Alerta: destaque aqui um cuidado importante do procedimento.</p>
<h3>Boas práticas</h3>
<table style="width:100%;border-collapse:collapse;">
  <tr>
    <td style="width:28px;vertical-align:top;padding:4px 8px 4px 0;">
      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#0f9d63"/><path d="M5.5 10.5l3 3 6-6.5" stroke="#fff" stroke-width="2" fill="none"/></svg>
    </td>
    <td style="padding:4px 0;">Primeira boa prática recomendada.</td>
  </tr>
  <tr>
    <td style="width:28px;vertical-align:top;padding:4px 8px 4px 0;">
      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#0f9d63"/><path d="M5.5 10.5l3 3 6-6.5" stroke="#fff" stroke-width="2" fill="none"/></svg>
    </td>
    <td style="padding:4px 0;">Segunda boa prática recomendada.</td>
  </tr>
</table>
<h3>Checklist final</h3>
<p>☐ Item 1<br>☐ Item 2<br>☐ Item 3</p>`,
  },
];

export type ModeloPersonalizado = ModeloDocumento & {
  criadoEm: string;
  autor: string;
  compartilhado: boolean;
};

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
  /** Modelos da galeria — embutidos + os que o usuário salvou ("Meus modelos"). */
  todosOsModelos: ModeloDocumento[];
  modelosPersonalizados: ModeloPersonalizado[];
  salvarComoModelo: (
    docId: string,
    dados: { nome: string; descricao: string; categoria: CategoriaModelo; compartilhado: boolean },
  ) => void;
  excluirModeloPersonalizado: (modeloId: string) => void;
  duplicarModelo: (modeloId: string) => void;
  modelosFavoritosIds: string[];
  alternarFavoritoModelo: (modeloId: string) => void;
  modelosRecentesIds: string[];
};

const DocumentosContext = createContext<DocumentosContextValue | null>(null);

/** "Favoritos"/"recentes" de modelo (listas de id de navegação, não conteúdo dono) continuam só no
 * localStorage — mesmo precedente já aberto com "azuz-crm-documentos-prefs-ver" (preferência de
 * visualização, também nunca migrada). */
const MODELOS_FAVORITOS_STORAGE_KEY = "azuz-crm-documentos-modelos-favoritos";
const MODELOS_RECENTES_STORAGE_KEY = "azuz-crm-documentos-modelos-recentes";

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
/** Exportado só pra `prisma/seed.ts` semear a tabela — o Provider agora busca da API. */
export const DOCUMENTOS_INICIAIS: Documento[] = [
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
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [modelosPersonalizados, setModelosPersonalizados] = useState<ModeloPersonalizado[]>([]);

  useEffect(() => {
    fetch("/api/documentos")
      .then((r) => r.json())
      .then((dados: Documento[]) => setDocumentos(dados))
      .catch((erro) => console.error("Falha ao carregar documentos da API:", erro));
    fetch("/api/documentos-modelos")
      .then((r) => r.json())
      .then((dados: ModeloPersonalizado[]) => setModelosPersonalizados(dados))
      .catch((erro) => console.error("Falha ao carregar modelos de documento da API:", erro));
  }, []);

  const [modelosFavoritosIds, setModelosFavoritosIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const salvos = localStorage.getItem(MODELOS_FAVORITOS_STORAGE_KEY);
      return salvos ? (JSON.parse(salvos) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MODELOS_FAVORITOS_STORAGE_KEY, JSON.stringify(modelosFavoritosIds));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [modelosFavoritosIds]);

  const [modelosRecentesIds, setModelosRecentesIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const salvos = localStorage.getItem(MODELOS_RECENTES_STORAGE_KEY);
      return salvos ? (JSON.parse(salvos) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MODELOS_RECENTES_STORAGE_KEY, JSON.stringify(modelosRecentesIds));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [modelosRecentesIds]);

  const todosOsModelos: ModeloDocumento[] = [...MODELOS_DOCUMENTO, ...modelosPersonalizados];

  function alternarFavoritoModelo(modeloId: string) {
    setModelosFavoritosIds((prev) =>
      prev.includes(modeloId) ? prev.filter((mid) => mid !== modeloId) : [...prev, modeloId],
    );
  }

  function criarModeloRemoto(modelo: ModeloPersonalizado) {
    fetch("/api/documentos-modelos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modelo),
    }).catch((erro) => console.error("Falha ao salvar modelo de documento na API:", erro));
  }

  function salvarComoModelo(
    docId: string,
    dados: { nome: string; descricao: string; categoria: CategoriaModelo; compartilhado: boolean },
  ) {
    const doc = documentos.find((d) => d.id === docId);
    if (!doc) return;
    const conteudoHtml = doc.paginas.map((p) => p.conteudoHtml).join('<hr style="page-break-after:always;border:none;">');
    const novoModelo: ModeloPersonalizado = {
      id: idUnico("modelo-usuario"),
      nome: dados.nome.trim() || doc.titulo,
      descricao: dados.descricao.trim(),
      categoria: dados.categoria,
      conteudoHtml,
      criadoEm: agora(),
      autor: currentUser.name,
      compartilhado: dados.compartilhado,
    };
    setModelosPersonalizados((prev) => [novoModelo, ...prev]);
    criarModeloRemoto(novoModelo);
  }

  function excluirModeloPersonalizado(modeloId: string) {
    setModelosPersonalizados((prev) => prev.filter((m) => m.id !== modeloId));
    setModelosFavoritosIds((prev) => prev.filter((mid) => mid !== modeloId));
    fetch(`/api/documentos-modelos/${modeloId}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir modelo de documento na API:", erro),
    );
  }

  /** Duplica qualquer modelo (embutido ou já salvo por algum usuário) numa cópia própria e editável em
   * "Meus modelos" — não altera o original, então dá pra partir de um modelo pronto e ajustar à vontade. */
  function duplicarModelo(modeloId: string) {
    const original = todosOsModelos.find((m) => m.id === modeloId);
    if (!original) return;
    const copia: ModeloPersonalizado = {
      ...original,
      id: idUnico("modelo-usuario"),
      nome: `${original.nome} (cópia)`,
      criadoEm: agora(),
      autor: currentUser.name,
      compartilhado: false,
    };
    setModelosPersonalizados((prev) => [copia, ...prev]);
    criarModeloRemoto(copia);
  }

  function registrarModeloRecente(modeloId: string) {
    setModelosRecentesIds((prev) => [modeloId, ...prev.filter((mid) => mid !== modeloId)].slice(0, 8));
  }

  function criarDocumento(titulo?: string, modeloId?: string) {
    const id = idUnico("doc");
    const modelo = todosOsModelos.find((m) => m.id === modeloId);
    if (modeloId && modelo) registrarModeloRecente(modeloId);
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
    fetch("/api/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novo),
    }).catch((erro) => console.error("Falha ao criar documento na API:", erro));
    return id;
  }

  function atualizarDocumento(id: string, patch: Partial<Documento>) {
    setDocumentos((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, atualizadoEm: agora() } : d)),
    );
    fetch(`/api/documentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, atualizadoEm: agora() }),
    }).catch((erro) => console.error("Falha ao atualizar documento na API:", erro));
  }

  function excluirDocumento(id: string) {
    atualizarDocumento(id, { excluido: true });
  }

  function restaurarDocumento(id: string) {
    atualizarDocumento(id, { excluido: false });
  }

  function excluirPermanente(id: string) {
    setDocumentos((prev) => prev.filter((d) => d.id !== id));
    fetch(`/api/documentos/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir documento na API:", erro),
    );
  }

  function esvaziarLixeira() {
    const idsNaLixeira = documentos.filter((d) => d.excluido).map((d) => d.id);
    setDocumentos((prev) => prev.filter((d) => !d.excluido));
    for (const id of idsNaLixeira) {
      fetch(`/api/documentos/${id}`, { method: "DELETE" }).catch((erro) =>
        console.error("Falha ao excluir documento na API:", erro),
      );
    }
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
    fetch("/api/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copia),
    }).catch((erro) => console.error("Falha ao duplicar documento na API:", erro));
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
        todosOsModelos,
        modelosPersonalizados,
        salvarComoModelo,
        excluirModeloPersonalizado,
        duplicarModelo,
        modelosFavoritosIds,
        alternarFavoritoModelo,
        modelosRecentesIds,
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
