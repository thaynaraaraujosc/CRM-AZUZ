/**
 * Resumo de uma linha por nó (pro card no canvas) e definição das saídas
 * (handles nomeados) de cada tipo de nó — dois pedaços de lógica puramente
 * derivados do `data` do nó, sem estado próprio, usados tanto pelo
 * renderizador dos nós (`components/automation-flow/nodes`) quanto por quem
 * precisar descrever o fluxo em texto (simulador, etc).
 */

import type { Funil } from "@/lib/data";
import type {
  AguardarData,
  CondicaoGrupoData,
  FlowNode,
  FlowNodeCategory,
  GrupoCondicoes,
  MensagemBotoesData,
} from "./types";
import { TEMPLATES_WHATSAPP } from "./templates-whatsapp";

function nomeFunil(funis: Funil[] | undefined, funilId: unknown): string | undefined {
  if (typeof funilId !== "string" || !funilId) return undefined;
  return funis?.find((f) => f.id === funilId)?.nome ?? funilId;
}

function nomeEtapa(funis: Funil[] | undefined, funilId: unknown, etapaId: unknown): string | undefined {
  if (typeof etapaId !== "string" || !etapaId) return undefined;
  if (typeof funilId !== "string") return etapaId;
  const funil = funis?.find((f) => f.id === funilId);
  return funil?.colunas.find((c) => c.id === etapaId)?.titulo ?? etapaId;
}

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
      { handleId: "sim", label: "✓ Sim" },
      { handleId: "nao", label: "✕ Não" },
    ];
  }

  if (node.type === "mensagem_botoes" || node.type === "mensagem_lista") {
    const data = node.data as MensagemBotoesData;
    // Numeradas (1, 2, 3...) — é assim que o contato de fato as vê no formato de menu numerado,
    // e ajuda a diferenciar visualmente esse nó de múltiplas saídas de uma condição binária comum.
    const opcoes = (data.opcoes ?? []).map((o, i) => ({
      handleId: o.id,
      label: `${i + 1} · ${o.rotulo || "Opção sem nome"}`,
    }));
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
        { handleId: "ok", label: "✓ OK" },
        { handleId: "timeout", label: "⏱ Tempo esgotado" },
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
  comeca_com: "começa com",
  termina_com: "termina com",
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

const ROTULO_STATUS_NEGOCIO: Record<string, string> = {
  em_andamento: "Em andamento",
  ganho: "Ganho",
  perdido: "Perdido",
};

function primeiroCampoTexto(data: Record<string, unknown>): string | undefined {
  for (const chave of ["mensagem", "titulo", "motivo", "status", "valor", "url", "atendenteNome", "equipeNome", "etiquetaNome", "campoNome", "palavra", "formularioId", "templateId"]) {
    const v = data[chave];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/**
 * `resumoNo` sinaliza bloco incompleto embutindo a frase no próprio texto ("Sem etiqueta
 * escolhida", "sem regras definidas"...) — essa função reconhece esse padrão pra quem renderiza
 * poder destacar visualmente (ícone + cor de aviso) sem duplicar a lista de frases em outro lugar.
 * "Sem configuração adicional" fica de fora de propósito: é o estado normal (não um aviso) de
 * blocos sem nenhum campo pra preencher, como a maioria dos gatilhos.
 */
export function resumoIndicaIncompleto(texto: string): boolean {
  if (texto === "Sem configuração adicional") return false;
  return texto.startsWith("Sem ") || texto.startsWith("Selecione ") || texto === "sem regras definidas";
}

/** Uma linha de resumo por baixo do título do nó no canvas — o que esse bloco de fato faz, sem abrir
 * o painel de configuração. `funis` é opcional só pra quem chama sem acesso ao contexto (ex.: testes) —
 * sem ele, cai de volta pro id cru em vez do nome. */
export function resumoNo(node: FlowNode, funis?: Funil[]): string {
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
      const nome = (d.arquivoNomeExibicao as string | undefined) || (d.arquivoNome as string | undefined);
      if (!nome) return "Selecione um arquivo";
      const legenda = typeof d.legenda === "string" && d.legenda.trim() ? ` · "${truncar(d.legenda)}"` : "";
      return `${nome}${legenda}`;
    }
    case "mensagem_modelo_whatsapp": {
      const nomeTemplate = TEMPLATES_WHATSAPP.find((t) => t.id === d.templateId)?.nome;
      return nomeTemplate ? `Modelo: ${nomeTemplate}` : "Sem modelo escolhido";
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
      const funil = nomeFunil(funis, d.funilId);
      if (!d.etapaTitulo) return "Sem etapa escolhida";
      return funil ? `Mover pra "${d.etapaTitulo}" (${funil})` : `Mover pra "${d.etapaTitulo}"`;
    }
    case "alterar_funil": {
      const funil = nomeFunil(funis, d.funilId);
      return funil ? `Funil: ${funil}` : "Sem funil escolhido";
    }
    case "alterar_responsavel": {
      return d.atendenteNome ? `Responsável: ${d.atendenteNome}` : "Sem atendente escolhido";
    }
    case "criar_tarefa": {
      if (!d.titulo) return "Sem título definido";
      const prazo =
        d.modoPrazo === "imediatamente"
          ? "imediato"
          : d.modoPrazo === "data_especifica"
            ? (d.data ? `em ${d.data}` : "data específica")
            : d.prazoValor
              ? `prazo ${d.prazoValor}${String(d.prazoUnidade ?? "horas").charAt(0)}`
              : null;
      const partes = [d.categoria, `"${d.titulo}"`, prazo].filter(Boolean);
      return partes.join(" · ");
    }
    case "criar_lembrete": {
      return d.titulo ? `"${d.titulo}"` : "Sem título definido";
    }
    case "tarefa_criada":
    case "tarefa_concluida": {
      switch (d.filtroModo) {
        case "categoria":
          return d.categoria ? `Categoria: ${d.categoria}` : "Selecione uma categoria";
        case "titulo":
          return d.tituloContem ? `Título contém "${d.tituloContem}"` : "Selecione um título";
        case "responsavel":
          return d.responsavel ? `Responsável: ${d.responsavel}` : "Selecione um responsável";
        case "equipe":
          return d.equipe ? `Equipe: ${d.equipe}` : "Selecione uma equipe";
        case "funil":
          return nomeFunil(funis, d.funilId) ? `Funil: ${nomeFunil(funis, d.funilId)}` : "Selecione um funil";
        default:
          return "Qualquer tarefa";
      }
    }
    case "atualizar_campo": {
      return d.campoNome ? `${d.campoNome} = "${d.valor ?? ""}"` : "Sem campo escolhido";
    }
    case "encaminhar_equipe": {
      return d.equipeNome ? `Equipe: ${d.equipeNome}` : "Sem equipe escolhida";
    }
    case "atualizar_status": {
      const rotulo = ROTULO_STATUS_NEGOCIO[String(d.status)];
      if (!rotulo) return "Sem status escolhido";
      return d.status === "perdido" && d.motivoPerda ? `${rotulo} · "${truncar(String(d.motivoPerda), 40)}"` : rotulo;
    }
    case "atualizar_valor": {
      if (!d.valor) return "Sem valor definido";
      const prefixo = d.modo === "somar" ? "+" : d.modo === "subtrair" ? "-" : "";
      return `${prefixo}R$ ${d.valor}`;
    }
    case "agendar_consulta": {
      if (!d.data && !d.horario) return "Sem data/horário definidos";
      const partes = [d.data, d.horario, d.profissional].filter(Boolean);
      return partes.join(" · ") || "Sem data/horário definidos";
    }
    case "chamar_webhook": {
      return d.url ? String(d.url) : "Sem URL definida";
    }
    case "lead_entrou_etapa":
    case "lead_saiu_etapa":
    case "lead_parado_etapa": {
      const funil = nomeFunil(funis, d.funilId);
      const etapa = nomeEtapa(funis, d.funilId, d.etapaId);
      if (!funil) return "Selecione funil e etapa";
      if (!etapa) return `${funil} → Qualquer etapa`;
      return `${funil} → ${etapa}`;
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

const ROTULO_UNIDADE_TEMPO: Record<string, string> = {
  minutos: "minutos",
  horas: "horas",
  dias: "dias",
};

/**
 * Frase completa em linguagem natural — "o que este bloco fará" (item 35), pro painel de
 * configuração. Cobre os tipos com formulário dedicado; os demais caem num fallback genérico a
 * partir do resumo de uma linha (melhor que nada, mas sem tanta fluidez quanto os cobertos aqui).
 */
export function resumoNaturalNo(node: FlowNode, funis?: Funil[]): string {
  const d = node.data as Record<string, unknown>;

  switch (node.type) {
    case "lead_entrou_etapa":
    case "lead_saiu_etapa":
    case "lead_parado_etapa": {
      const funil = nomeFunil(funis, d.funilId);
      const etapa = nomeEtapa(funis, d.funilId, d.etapaId);
      if (!funil) return "Selecione um funil e uma etapa pra essa automação começar.";
      const preposicao = node.type === "lead_saiu_etapa" ? "da" : "na";
      const verbo = node.type === "lead_entrou_etapa" ? "entrar" : node.type === "lead_saiu_etapa" ? "sair" : "ficar parado";
      const etapaTexto = etapa ? `${preposicao} etapa ${etapa}` : "em qualquer etapa";
      const base = `Esta automação ${node.category === "gatilho" ? "será iniciada" : "roda"} quando um lead ${verbo} ${etapaTexto} do funil ${funil}`;
      if (node.type === "lead_parado_etapa" && typeof d.tempoValor === "number") {
        return `${base}, por pelo menos ${d.tempoValor} ${ROTULO_UNIDADE_TEMPO[String(d.tempoUnidade)] ?? "horas"}.`;
      }
      return `${base}.`;
    }
    case "tarefa_criada":
    case "tarefa_concluida": {
      const verbo = node.type === "tarefa_criada" ? "for criada" : "for concluída";
      switch (d.filtroModo) {
        case "categoria":
          return d.categoria
            ? `Dispara quando uma tarefa de "${d.categoria}" ${verbo}.`
            : "Selecione a categoria de tarefa que deve disparar essa automação.";
        case "titulo":
          return d.tituloContem
            ? `Dispara quando uma tarefa com título contendo "${d.tituloContem}" ${verbo}.`
            : "Digite um trecho do título da tarefa.";
        case "responsavel":
          return d.responsavel
            ? `Dispara quando uma tarefa de ${d.responsavel} ${verbo}.`
            : "Selecione o responsável da tarefa.";
        case "equipe":
          return d.equipe
            ? `Dispara quando uma tarefa da equipe ${d.equipe} ${verbo}.`
            : "Selecione a equipe da tarefa.";
        case "funil":
          return nomeFunil(funis, d.funilId)
            ? `Dispara quando uma tarefa relacionada ao funil ${nomeFunil(funis, d.funilId)} ${verbo}.`
            : "Selecione o funil relacionado à tarefa.";
        default:
          return `Dispara quando qualquer tarefa ${verbo}.`;
      }
    }
    case "adicionar_etiqueta":
      return d.etiquetaNome
        ? `Adiciona a etiqueta "${d.etiquetaNome}" ao contato.`
        : "Selecione qual etiqueta adicionar ao contato.";
    case "remover_etiqueta":
      return d.etiquetaNome
        ? `Remove a etiqueta "${d.etiquetaNome}" do contato.`
        : "Selecione qual etiqueta remover do contato.";
    case "alterar_etapa": {
      const funil = nomeFunil(funis, d.funilId);
      if (!d.etapaTitulo) return "Selecione o funil e a etapa de destino.";
      return `Move o lead para a etapa "${d.etapaTitulo}"${funil ? ` do funil ${funil}` : ""}.`;
    }
    case "alterar_funil": {
      const funil = nomeFunil(funis, d.funilId);
      return funil ? `Move o lead para o funil ${funil}.` : "Selecione o funil de destino.";
    }
    case "criar_tarefa": {
      if (!d.titulo) return "Defina ao menos o título dessa tarefa.";
      const responsavel =
        d.modoResponsavel === "pessoa"
          ? (d.responsavel as string) || "a pessoa escolhida"
          : d.modoResponsavel === "equipe"
            ? `a equipe ${(d.equipe as string) || "escolhida"}`
            : "o responsável atual do lead";
      const prazo =
        d.modoPrazo === "imediatamente"
          ? "imediatamente"
          : d.modoPrazo === "data_especifica"
            ? (d.data ? `em ${d.data}${d.horario ? ` às ${d.horario}` : ""}` : "numa data específica")
            : d.prazoValor
              ? `com prazo de ${d.prazoValor} ${ROTULO_UNIDADE_TEMPO[String(d.prazoUnidade)] ?? "horas"}`
              : "sem prazo definido";
      return `Cria uma tarefa${d.categoria ? ` de ${d.categoria}` : ""} "${d.titulo}" para ${responsavel}, ${prazo}.`;
    }
    case "aguardar": {
      const data = node.data as AguardarData;
      if (data.modo === "ate_resposta") return "Aguarda até o lead responder antes de continuar.";
      if (data.modo === "ate_tarefa") return "Aguarda até a tarefa relacionada ser concluída.";
      if (data.modo === "ate_consulta") return "Aguarda até a data da consulta.";
      if (data.modo === "ate_data") return "Aguarda até a data específica configurada.";
      if (data.modo === "ate_horario") return "Aguarda até o horário específico configurado.";
      return data.valor ? `Pausa o fluxo por ${data.valor} ${ROTULO_UNIDADE_TEMPO[data.modo] ?? data.modo}.` : "Defina por quanto tempo o fluxo deve pausar.";
    }
    case "condicao_grupo": {
      const data = node.data as CondicaoGrupoData;
      return `Verifica se ${resumoGrupoCondicoes(data.grupo)} — segue por caminhos diferentes conforme o resultado.`;
    }
    case "mensagem_texto": {
      if (!d.texto) return "Escreva a mensagem que será enviada.";
      const canal = ROTULO_CANAL[String(d.canal)] ?? String(d.canal ?? "WhatsApp");
      return `Envia uma mensagem pelo ${canal}.`;
    }
    case "encaminhar_equipe":
      return d.equipeNome ? `Encaminha o atendimento para a equipe ${d.equipeNome}.` : "Selecione a equipe que vai receber o atendimento.";
    case "atualizar_status": {
      const rotulo = ROTULO_STATUS_NEGOCIO[String(d.status)];
      if (!rotulo) return "Selecione o novo status do negócio.";
      if (d.status === "perdido") {
        return d.motivoPerda ? `Marca o negócio como Perdido, com o motivo "${d.motivoPerda}".` : "Defina o motivo da perda.";
      }
      return `Atualiza o status do negócio para ${rotulo}.`;
    }
    case "atualizar_valor": {
      if (!d.valor) return "Defina o valor a ser aplicado.";
      if (d.modo === "somar") return `Soma R$ ${d.valor} ao valor atual do negócio.`;
      if (d.modo === "subtrair") return `Subtrai R$ ${d.valor} do valor atual do negócio.`;
      return `Define o valor do negócio como R$ ${d.valor}.`;
    }
    case "agendar_consulta": {
      if (!d.data && !d.horario) return "Defina a data e o horário da consulta.";
      const quando = [d.data, d.horario].filter(Boolean).join(" às ");
      const comQuem = d.profissional ? ` com ${d.profissional}` : "";
      const tipo = d.tipoServico ? ` (${d.tipoServico})` : "";
      return `Agenda uma consulta${comQuem} para ${quando}${tipo}.`;
    }
    default: {
      const linha = resumoNo(node, funis);
      if (linha === "Sem configuração adicional") return "Esse bloco não precisa de configuração adicional.";
      return resumoIndicaIncompleto(linha) ? "Complete a configuração desse bloco pra ele funcionar." : linha;
    }
  }
}

const ROTULO_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  email: "e-mail",
  interno: "canal interno",
};
