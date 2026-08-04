"use client";

import { useState } from "react";

import type {
  AguardarData,
  AgendarConsultaData,
  AtualizarStatusData,
  AtualizarValorData,
  CondicaoGrupoData,
  ConfiguracoesFluxo,
  CriarTarefaData,
  EncaminharEquipeData,
  FlowNode,
  FluxoAutomacao,
  MensagemBotoesData,
  MensagemModeloWhatsappData,
  ProblemaValidacao,
  TarefaEventoData,
} from "@/lib/automation-flow/types";
import { resumoNaturalNo } from "@/lib/automation-flow/resumo";
import { useFunis } from "@/lib/funis-context";
import { AgendarConsultaForm } from "./forms/AgendarConsultaForm";
import { AguardarForm } from "./forms/AguardarForm";
import { AtualizarStatusForm } from "./forms/AtualizarStatusForm";
import { AtualizarValorForm } from "./forms/AtualizarValorForm";
import { CondicaoForm } from "./forms/CondicaoForm";
import { ConfiguracoesGeraisForm } from "./forms/ConfiguracoesGeraisForm";
import { CriarTarefaForm } from "./forms/CriarTarefaForm";
import { EncaminharEquipeForm } from "./forms/EncaminharEquipeForm";
import { GenericForm } from "./forms/GenericForm";
import { MensagemForm } from "./forms/MensagemForm";
import { MensagemMidiaForm } from "./forms/MensagemMidiaForm";
import { MensagemModeloForm } from "./forms/MensagemModeloForm";
import { MensagemOpcoesForm } from "./forms/MensagemOpcoesForm";
import { TarefaEventoForm } from "./forms/TarefaEventoForm";

const TIPOS_OPCOES = new Set(["mensagem_botoes", "mensagem_lista"]);
const TIPOS_MIDIA = new Set(["mensagem_imagem", "mensagem_video", "mensagem_audio", "mensagem_documento"]);
const TIPOS_TAREFA_EVENTO = new Set(["tarefa_criada", "tarefa_concluida"]);

function FormularioDoNode({
  node,
  onUpdateNodeData,
  onRemoverOpcaoAresta,
}: {
  node: FlowNode;
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onRemoverOpcaoAresta: (nodeId: string, opcaoId: string) => void;
}) {
  if (node.type === "condicao_grupo") {
    const data = node.data as CondicaoGrupoData;
    return <CondicaoForm grupo={data.grupo} onChange={(grupo) => onUpdateNodeData(node.id, { grupo })} />;
  }
  if (node.type === "aguardar") {
    return <AguardarForm data={node.data as AguardarData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (TIPOS_TAREFA_EVENTO.has(node.type)) {
    return <TarefaEventoForm data={node.data as TarefaEventoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "criar_tarefa") {
    return <CriarTarefaForm data={node.data as CriarTarefaData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "encaminhar_equipe") {
    return <EncaminharEquipeForm data={node.data as EncaminharEquipeData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "atualizar_status") {
    return <AtualizarStatusForm data={node.data as AtualizarStatusData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "atualizar_valor") {
    return <AtualizarValorForm data={node.data as AtualizarValorData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "agendar_consulta") {
    return <AgendarConsultaForm data={node.data as AgendarConsultaData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "mensagem_modelo_whatsapp") {
    return <MensagemModeloForm data={node.data as MensagemModeloWhatsappData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (TIPOS_OPCOES.has(node.type)) {
    return (
      <MensagemOpcoesForm
        data={node.data as MensagemBotoesData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
        onRemoverOpcao={(opcaoId) => onRemoverOpcaoAresta(node.id, opcaoId)}
      />
    );
  }
  if (TIPOS_MIDIA.has(node.type)) {
    return <MensagemMidiaForm node={node} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.category === "mensagem") {
    return <MensagemForm node={node} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  return <GenericForm node={node} onChange={(d) => onUpdateNodeData(node.id, d)} />;
}

export function ConfigPanel({
  fluxo,
  selectedNodes,
  problemas,
  onUpdateFluxoMeta,
  onUpdateConfiguracoes,
  onUpdateNode,
  onUpdateNodeData,
  onRemoverOpcaoAresta,
  onSelecionarNode,
}: {
  fluxo: FluxoAutomacao;
  selectedNodes: FlowNode[];
  problemas: ProblemaValidacao[];
  onUpdateFluxoMeta: (patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) => void;
  onUpdateConfiguracoes: (patch: Partial<ConfiguracoesFluxo>) => void;
  onUpdateNode: (nodeId: string, patch: Partial<Pick<FlowNode, "titulo" | "observacao">>) => void;
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onRemoverOpcaoAresta: (nodeId: string, opcaoId: string) => void;
  onSelecionarNode: (nodeId: string) => void;
}) {
  const [aba, setAba] = useState<"configurar" | "problemas">("configurar");
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const { funis } = useFunis();

  return (
    <aside className="flow-config" aria-label="Painel de configuração">
      <div className="flow-config-tabs">
        <button type="button" className={`flow-tab${aba === "configurar" ? " on" : ""}`} onClick={() => setAba("configurar")}>
          Configurar
        </button>
        <button type="button" className={`flow-tab${aba === "problemas" ? " on" : ""}`} onClick={() => setAba("problemas")}>
          Problemas{problemas.length > 0 ? ` (${problemas.length})` : ""}
        </button>
      </div>

      <div className="flow-config-body">
        {aba === "problemas" ? (
          <div className="flow-form">
            {problemas.length === 0 ? (
              <p className="hint">Nenhum problema encontrado — esse fluxo está pronto pra publicar.</p>
            ) : (
              problemas.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`flow-problema${p.severidade === "erro" ? " erro" : " aviso"}`}
                  onClick={() => p.nodeId && onSelecionarNode(p.nodeId)}
                  disabled={!p.nodeId}
                >
                  <span className="flow-problema-sev">{p.severidade === "erro" ? "⛔" : "⚠️"}</span>
                  <span>{p.mensagem}</span>
                </button>
              ))
            )}
          </div>
        ) : node ? (
          <>
            <div className="panel-h">
              <h4>{node.titulo || node.type}</h4>
            </div>
            <div className="flow-form">
              <div className="field">
                <label>Título do bloco</label>
                <input
                  className="input"
                  placeholder={node.type}
                  value={node.titulo ?? ""}
                  onChange={(e) => onUpdateNode(node.id, { titulo: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Observação (só pra sua equipe)</label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                  value={node.observacao ?? ""}
                  onChange={(e) => onUpdateNode(node.id, { observacao: e.target.value })}
                />
              </div>
            </div>
            <div className="panel-h divided">
              <h4>Configuração</h4>
            </div>
            <FormularioDoNode node={node} onUpdateNodeData={onUpdateNodeData} onRemoverOpcaoAresta={onRemoverOpcaoAresta} />
            <div className="panel-h divided">
              <h4>O que este bloco fará</h4>
            </div>
            <div className="flow-form">
              <p className="hint flow-resumo-natural">{resumoNaturalNo(node, funis)}</p>
            </div>
          </>
        ) : selectedNodes.length > 1 ? (
          <p className="hint">{selectedNodes.length} blocos selecionados — selecione um só pra configurar, ou nenhum pra ver as configurações gerais do fluxo.</p>
        ) : (
          <>
            <div className="panel-h">
              <h4>Configurações gerais</h4>
            </div>
            <ConfiguracoesGeraisForm fluxo={fluxo} onChange={onUpdateFluxoMeta} onChangeConfiguracoes={onUpdateConfiguracoes} />
          </>
        )}
      </div>
    </aside>
  );
}
