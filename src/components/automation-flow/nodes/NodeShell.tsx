"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoIndicaIncompleto, resumoNo, saidasDoNo, temEntrada } from "@/lib/automation-flow/resumo";
import type { FlowNodeCategory } from "@/lib/automation-flow/types";
import { useFunis } from "@/lib/funis-context";
import type { FlowRFNode } from "../utils";

/** lucide-react não está instalado nesse projeto — glyph curto por categoria no lugar de ícone de verdade. */
const GLYPH_CATEGORIA: Record<FlowNodeCategory, string> = {
  gatilho: "⚡",
  condicao: "🔀",
  mensagem: "💬",
  espera: "⏱",
  acao: "⚙️",
  humano: "🧑‍💼",
  integracao: "🔌",
  fim: "🏁",
};

/** Nome da categoria mostrado em cima do título — a leitura do tipo de bloco precisa funcionar sem abrir o nó. */
const NOME_CATEGORIA: Record<FlowNodeCategory, string> = {
  gatilho: "Gatilho",
  condicao: "Condição",
  mensagem: "Mensagem",
  espera: "Espera",
  acao: "Ação",
  humano: "Humano",
  integracao: "Integração",
  fim: "Fim",
};

/**
 * Renderizador único de nó, reaproveitado pelos 8 componentes registrados em
 * `nodeTypes` (um por `FlowNodeCategory`) — a diferença visual/comportamental
 * entre tipos dentro da mesma categoria vem só de `saidasDoNo`/`resumoNo`,
 * então não faz sentido duplicar esse JSX 8 vezes.
 */
export function NodeShell({ id, data, selected }: NodeProps<FlowRFNode>) {
  const { flowNode, problemas, saidasConectadas, caminhosConvergindo, ordemNarrativa, explicacao, onAdicionarApos } = data;
  const { funis } = useFunis();
  const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === flowNode.type);
  const saidas = saidasDoNo(flowNode);
  const temErro = problemas.some((p) => p.severidade === "erro");
  const temAviso = !temErro && problemas.some((p) => p.severidade === "aviso");
  const classes = [
    "flow-node",
    `flow-cat-${flowNode.category}`,
    selected ? "is-selected" : "",
    temErro ? "has-error" : temAviso ? "has-warning" : "",
    flowNode.desativado ? "is-desativado" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-node-id={id}>
      {temEntrada(flowNode.category) ? (
        <Handle type="target" position={Position.Top} className="flow-handle" />
      ) : null}

      {ordemNarrativa ? (
        <span className="flow-node-ordem" aria-hidden="true">
          {ordemNarrativa}
        </span>
      ) : null}

      {caminhosConvergindo && caminhosConvergindo > 1 ? (
        <div className="flow-node-convergencia" title={`${caminhosConvergindo} caminhos diferentes se encontram aqui`}>
          ⤵ {caminhosConvergindo} caminhos se encontram aqui
        </div>
      ) : null}

      <div className="flow-node-header">
        <span className="flow-node-icon" aria-hidden="true">
          {GLYPH_CATEGORIA[flowNode.category]}
        </span>
        <span className="flow-node-textos">
          <span className="flow-node-categoria">{NOME_CATEGORIA[flowNode.category]}</span>
          <span className="flow-node-label">{flowNode.titulo || bloco?.label || flowNode.type}</span>
        </span>
        {flowNode.desativado ? <span className="flow-node-pausado-badge">Pausado</span> : null}
        {temErro || temAviso ? (
          <span
            className="flow-node-warn"
            title={problemas.map((p) => p.mensagem).join(" · ")}
            aria-label={`Problema: ${problemas[0]?.mensagem ?? ""}`}
          >
            {temErro ? "⛔" : "⚠️"}
          </span>
        ) : null}
      </div>

      {(() => {
        const resumo = resumoNo(flowNode, funis);
        const incompleto = resumoIndicaIncompleto(resumo);
        return (
          <div className={`flow-node-body${incompleto ? " flow-node-body-incompleto" : ""}`}>
            {incompleto ? <span aria-hidden="true">⚠ </span> : null}
            {resumo}
          </div>
        );
      })()}

      {explicacao ? <div className="flow-node-explicacao">💡 {explicacao}</div> : null}

      {saidas.length > 1 ? (
        <div className="flow-node-handles">
          {saidas.map((s) => {
            const chave = s.handleId ?? "__default__";
            const conectada = saidasConectadas?.has(chave) ?? false;
            /* Condição binária (item 8): "Sim"/"Não" tem que ler como uma bifurcação clara, não só
               mais uma linha de opção igual às outras — verde/vermelho reforça qual caminho é qual
               sem precisar ler o texto. */
            const corBifurcacao = flowNode.category === "condicao" ? (chave === "sim" ? "sim" : chave === "nao" ? "nao" : undefined) : undefined;
            /* Pergunta com várias opções (item 8): visual de "menu" (pill azulado) — diferente da
               bifurcação binária de condição, pra não parecer o mesmo tipo de componente. */
            const ehOpcaoDePergunta =
              (flowNode.type === "mensagem_botoes" || flowNode.type === "mensagem_lista") &&
              chave !== "outra_resposta" &&
              chave !== "nao_respondeu";
            return (
              <div
                className={`flow-node-handle-row${corBifurcacao ? ` is-bifurcacao-${corBifurcacao}` : ""}${ehOpcaoDePergunta ? " is-opcao-pergunta" : ""}`}
                key={chave}
              >
                <span className="flow-handle-label">{s.label}</span>
                {!conectada && onAdicionarApos ? (
                  <button
                    type="button"
                    className="flow-node-add-inline"
                    title="O que acontece agora?"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdicionarApos(s.handleId);
                    }}
                  >
                    +
                  </button>
                ) : null}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={s.handleId}
                  className="flow-handle flow-handle-inline"
                />
              </div>
            );
          })}
        </div>
      ) : saidas.length === 1 ? (
        <div className="flow-node-saida-unica">
          <Handle type="source" position={Position.Bottom} className="flow-handle" />
          {!(saidasConectadas?.has("__default__") ?? false) && onAdicionarApos ? (
            <button
              type="button"
              className="flow-node-add-btn"
              title="O que acontece agora?"
              onClick={(e) => {
                e.stopPropagation();
                onAdicionarApos(undefined);
              }}
            >
              +
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
