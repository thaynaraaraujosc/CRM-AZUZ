/**
 * Resumo de uma linha por nó (pro card no canvas) e definição das saídas
 * (handles nomeados) de cada tipo de nó — dois pedaços de lógica puramente
 * derivados do `data` do nó, sem estado próprio, usados tanto pelo
 * renderizador dos nós (`components/automation-flow/nodes`) quanto por quem
 * precisar descrever o fluxo em texto (simulador, etc).
 */

import type {
  AguardarData,
  CondicaoGrupoData,
  FlowNode,
  FlowNodeCategory,
  GrupoCondicoes,
  MensagemBotoesData,
} from "./types";

export type SaidaNo = { handleId?: string; label: string };

const CATEGORIAS_SEM_ENTRADA: FlowNodeCategory[] = ["gatilho"];
const CATEGORIAS_SEM_SAIDA: FlowNodeCategory[] = ["fim"];

export function temEntrada(categoria: FlowNodeCategory): boolean {
  return !CATEGORIAS_SEM_ENTRADA.includes(categoria);
}

/** Handles de saída do nó — vazio pra blocos de fim, um só (sem rótulo) pro caso comum, vários nomeados pra quem ramifica. */
export function saidasDoNo(node: FlowNode): SaidaNo[] {
  if (CATEGORIAS_SEM_SAIDA.includes(node.category)) return [];

  if (node.type === "condicao_grupo") {
    return [
      { handleId: "sim", label: "Sim" },
      { handleId: "nao", label: "Não" },
    ];
  }

  if (node.type === "mensagem_botoes" || node.type === "mensagem_lista") {
    const data = node.data as MensagemBotoesData;
    const opcoes = (data.opcoes ?? []).map((o) => ({ handleId: o.id, label: o.rotulo || "Opção sem nome" }));
    return [
      ...opcoes,
      { handleId: "outra_resposta", label: "Outra resposta" },
      { handleId: "nao_respondeu", label: "Não respondeu" },
    ];
  }

  if (node.type === "aguardar") {
    const data = node.data as AguardarData;
    if (data.tempoMaximo) {
      return [
        { handleId: "ok", label: "OK" },
        { handleId: "timeout", label: "Tempo esgotado" },
      ];
    }
  }

  return [{ handleId: undefined, label: "" }];
}

function truncar(texto: string, max = 64): string {
  const t = texto.trim();
  if (!t) return "(vazio)";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const ROTULO_OPERADOR: Record<string, string> = {
  igual: "é",
  diferente: "não é",
  contem: "contém",
  nao_contem: "não contém",
  maior_que: ">",
  menor_que: "<",
  entre: "entre",
  existe: "existe",
  nao_existe: "não existe",
};

function resumoGrupoCondicoes(grupo: GrupoCondicoes | undefined): string {
  if (!grupo || (grupo.regras.length === 0 && grupo.subgrupos.length === 0)) return "sem regras definidas";

  const partes: string[] = [];
  grupo.regras.forEach((r) => {
    const campo = r.campo === "campo_personalizado" ? (r.campoPersonalizadoNome || "campo") : r.campo;
    const op = ROTULO_OPERADOR[r.operador] ?? r.operador;
    const valor = r.operador === "entre" ? `${r.valor ?? "?"} e ${r.valorFim ?? "?"}` : r.valor;
    partes.push(valor ? `${campo} ${op} "${valor}"` : `${campo} ${op}`);
  });
  grupo.subgrupos.forEach((g) => partes.push(`(${resumoGrupoCondicoes(g)})`));

  const conector = grupo.tipo === "OU" ? " OU " : " E ";
  const texto = partes.join(conector);
  return grupo.tipo === "NAO" ? `NÃO (${texto})` : texto;
}

function primeiroCampoTexto(data: Record<string, unknown>): string | undefined {
  for (const chave of ["mensagem", "titulo", "motivo", "status", "valor", "url", "atendenteNome", "equipeNome", "etiquetaNome", "campoNome", "palavra", "formularioId", "templateId"]) {
    const v = data[chave];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/** Uma linha de resumo por baixo do título do nó no canvas — o que esse bloco de fato faz, sem abrir o painel de configuração. */
export function resumoNo(node: FlowNode): string {
  const d = node.data as Record<string, unknown>;

  switch (node.type) {
    case "condicao_grupo": {
      const data = node.data as CondicaoGrupoData;
      return resumoGrupoCondicoes(data.grupo);
    }
    case "mensagem_texto": {
      return `"${truncar(String(d.texto ?? ""))}" · Canal: ${d.canal ?? "whatsapp"}`;
    }
    case "mensagem_email": {
      return `Assunto: "${truncar(String(d.assunto ?? ""))}"`;
    }
    case "notificacao_interna":
    case "enviar_notificacao": {
      return `"${truncar(String(d.mensagem ?? ""))}"`;
    }
    case "mensagem_botoes":
    case "mensagem_lista": {
      const data = node.data as MensagemBotoesData;
      const n = data.opcoes?.length ?? 0;
      return `"${truncar(data.texto ?? "")}" · ${n} ${n === 1 ? "opção" : "opções"}`;
    }
    case "mensagem_imagem":
    case "mensagem_video":
    case "mensagem_audio":
    case "mensagem_documento": {
      return `${d.arquivoNome ? `Arquivo: ${d.arquivoNome}` : "Sem arquivo definido"} · Canal: ${d.canal ?? "whatsapp"}`;
    }
    case "mensagem_modelo_whatsapp": {
      return d.templateId ? `Modelo: ${d.templateId}` : "Sem modelo escolhido";
    }
    case "enviar_formulario": {
      return d.formularioOrigem === "externo" ? `Link externo${d.formularioUrlExterna ? `: ${d.formularioUrlExterna}` : ""}` : "Formulário interno";
    }
    case "aguardar": {
      const data = node.data as AguardarData;
      switch (data.modo) {
        case "ate_resposta":
          return "Até resposta";
        case "ate_tarefa":
          return "Até a tarefa ser concluída";
        case "ate_consulta":
          return "Até a data da consulta";
        case "ate_data":
          return "Até uma data específica";
        case "ate_horario":
          return "Até um horário específico";
        default:
          return data.valor ? `Até ${data.valor} ${data.modo}` : "Sem tempo definido";
      }
    }
    case "adicionar_etiqueta":
    case "remover_etiqueta": {
      return d.etiquetaNome ? `Etiqueta: "${d.etiquetaNome}"` : "Sem etiqueta escolhida";
    }
    case "alterar_etapa": {
      return d.etapaTitulo ? `Mover pra "${d.etapaTitulo}"` : "Sem etapa escolhida";
    }
    case "alterar_funil": {
      return d.funilId ? `Funil: ${d.funilId}` : "Sem funil escolhido";
    }
    case "alterar_responsavel": {
      return d.atendenteNome ? `Responsável: ${d.atendenteNome}` : "Sem atendente escolhido";
    }
    case "criar_tarefa":
    case "criar_lembrete": {
      return d.titulo ? `"${d.titulo}"` : "Sem título definido";
    }
    case "atualizar_campo": {
      return d.campoNome ? `${d.campoNome} = "${d.valor ?? ""}"` : "Sem campo escolhido";
    }
    case "chamar_webhook": {
      return d.url ? String(d.url) : "Sem URL definida";
    }
    case "lead_entrou_etapa":
    case "lead_saiu_etapa":
    case "lead_parado_etapa": {
      const partes = [d.funilId ? `Funil: ${d.funilId}` : null, d.etapaId ? `Etapa: ${d.etapaId}` : null].filter(Boolean);
      return partes.length ? partes.join(" · ") : "Qualquer funil/etapa";
    }
    case "palavra_chave": {
      return d.palavra ? `"${d.palavra}"` : "Sem palavra definida";
    }
    case "webhook_recebido": {
      return d.identificador ? `Identificador: ${d.identificador}` : "Qualquer webhook";
    }
    case "encerrar_fluxo": {
      return d.motivo ? String(d.motivo) : "Fim do caminho";
    }
    default: {
      const texto = primeiroCampoTexto(d);
      return texto ? truncar(texto) : "Sem configuração adicional";
    }
  }
}
