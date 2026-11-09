"use client";

import { useState } from "react";

import type {
  AguardarData,
  AgendarConsultaData,
  AtualizarStatusData,
  AtualizarValorData,
  CancelarAgendamentoData,
  CondicaoGrupoData,
  CondicaoRamosData,
  ConfiguracoesFluxo,
  CriarTarefaData,
  DistribuirDisponibilidadeData,
  EncaminharEquipeData,
  EncaminharHumanoData,
  AtualizarCampoData,
  EncerrarFluxoData,
  ExecutarRoboData,
  ReagirMensagemData,
  DecisaoMultiplaData,
  DistribuirSorteioData,
  IaClassificarData,
  FlowNode,
  FlowNodeType,
  FluxoAutomacao,
  MensagemBotoesData,
  MensagemContatoData,
  MensagemEmailData,
  MensagemLocalizacaoData,
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
import { CancelarAgendamentoForm } from "./forms/CancelarAgendamentoForm";
import { ComentarioInstagramForm } from "./forms/ComentarioInstagramForm";
import { StoryRespondidoForm } from "./forms/StoryRespondidoForm";
import { CondicaoForm } from "./forms/CondicaoForm";
import { CondicaoRamosForm } from "./forms/CondicaoRamosForm";
import { ConfiguracoesGeraisForm } from "./forms/ConfiguracoesGeraisForm";
import { CriarTarefaForm } from "./forms/CriarTarefaForm";
import { DistribuirDisponibilidadeForm } from "./forms/DistribuirDisponibilidadeForm";
import { EncaminharEquipeForm } from "./forms/EncaminharEquipeForm";
import { EncaminharHumanoForm } from "./forms/EncaminharHumanoForm";
import { DecisaoMultiplaForm } from "./forms/DecisaoMultiplaForm";
import { IaClassificarForm } from "./forms/IaClassificarForm";
import { GenericForm } from "./forms/GenericForm";
import { ExecutarRoboForm } from "./forms/ExecutarRoboForm";
import { EncerrarFluxoForm } from "./forms/EncerrarFluxoForm";
import { AtualizarCampoForm } from "./forms/AtualizarCampoForm";
import { ReagirMensagemForm } from "./forms/ReagirMensagemForm";
import { MensagemContatoForm } from "./forms/MensagemContatoForm";
import { MensagemEmailForm } from "./forms/MensagemEmailForm";
import { MensagemForm } from "./forms/MensagemForm";
import { MensagemLocalizacaoForm } from "./forms/MensagemLocalizacaoForm";
import { FormularioPreenchidoForm } from "./forms/FormularioPreenchidoForm";
import { MensagemMidiaForm } from "./forms/MensagemMidiaForm";
import { MensagemModeloForm } from "./forms/MensagemModeloForm";
import { MensagemOpcoesForm } from "./forms/MensagemOpcoesForm";
import { TarefaEventoForm } from "./forms/TarefaEventoForm";
import { IconAlerta, IconCheck, IconClose, IconErro } from "@/components/icons";
import { Ajuda } from "@/components/ui";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { EscolhaDeConteudo } from "./forms/EscolhaDeConteudo";
import { DistribuirSorteioForm } from "./forms/DistribuirSorteioForm";

/**
 * Os tipos que a escolha de formato troca entre si.
 *
 * É uma lista fechada de propósito: trocar o tipo de um bloco APAGA as ligações que saíam dele
 * (ver `trocarTipoDoNode`), e isso só é aceitável entre formatos da mesma mensagem. Oferecer a
 * troca num bloco de condição faria a pessoa perder dois caminhos sem ser avisada.
 */
const FORMATOS_DE_MENSAGEM: FlowNodeType[] = [
  "mensagem_texto",
  "mensagem_botoes",
  "aguardar",
  "mensagem_audio",
  "mensagem_imagem",
  "mensagem_video",
  "mensagem_documento",
];
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { useIdioma } from "@/lib/idioma-context";

const TIPOS_OPCOES = new Set(["mensagem_botoes", "mensagem_lista"]);
const TIPOS_MIDIA = new Set(["mensagem_imagem", "mensagem_video", "mensagem_audio", "mensagem_documento"]);
const TIPOS_TAREFA_EVENTO = new Set(["tarefa_criada", "tarefa_concluida"]);

/** Gatilhos do Instagram cuja configuração mora na gaveta, e não neste painel. */
const ALCANCE_NA_GAVETA = new Set<string>([
  "comentario_instagram",
  "instagram_resposta_comentario",
  "instagram_story_respondido",
  "instagram_comentario_live",
  "instagram_direct_recebido",
  "instagram_mencao_story",
]);

function FormularioDoNode({
  node,
  area,
  fluxoAtualId,
  onUpdateNodeData,
  onRemoverOpcaoAresta,
  onTrocarTipo,
  onAbrirGatilhos,
}: {
  node: FlowNode;
  /** Comercial ou social: decide os canais que os formulários de mensagem oferecem. */
  area: AreaAutomacao;
  fluxoAtualId?: string;
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onRemoverOpcaoAresta: (nodeId: string, opcaoId: string) => void;
  /** Troca o tipo do bloco. É o que transforma uma mensagem de texto em pergunta com botões. */
  onTrocarTipo?: (nodeId: string, tipo: FlowNodeType, data: Record<string, unknown>) => void;
  /** Abre a gaveta dos gatilhos, que é onde palavra-chave e alcance moram no Social Seller. */
  onAbrirGatilhos?: () => void;
}) {
  /*
   * NO SOCIAL SELLER, A PALAVRA-CHAVE E O ALCANCE NÃO MORAM AQUI.
   *
   * Este painel tinha o formulário completo do gatilho — "PALAVRAS QUE DISPARAM", "COMO
   * COMPARAR" com três opções, "EM QUAL STORY" — e a gaveta tem o mesmo assunto com OUTRAS
   * palavras e outro desenho. Duas telas pra mesma configuração é como se chega em duas
   * verdades: a pessoa muda numa, confere na outra e encontra coisa diferente.
   *
   * A gaveta ganhou: ela é a que a referência desenha, a que o cartão do canvas abre e a que
   * edita TODOS os gatilhos de uma vez (as palavras valem pro fluxo, não pro bloco). Aqui fica o
   * caminho pra ela — e o título e a observação do bloco, que são deste painel mesmo.
   */
  if (area === "social" && ALCANCE_NA_GAVETA.has(node.type) && onAbrirGatilhos) {
    return (
      <div className="flow-form">
        <p className="hint">
          As palavras-chave e onde este gatilho vale ficam no cartão{" "}
          <strong>O que inicia a automação</strong>, no quadro — ali eles valem pra automação
          inteira, e não só pra este bloco.
        </p>
        <button type="button" className="btn" onClick={onAbrirGatilhos}>
          Abrir os gatilhos
        </button>
      </div>
    );
  }
  // Resposta a story: palavras, modo de comparação e a escolha de QUAL story, entre os que estão
  // no ar agora. Formulário separado do de comentário porque a lista tem regra própria: story
  // dura 24 horas e some sozinho.
  if (node.type === "condicao_ramos") {
    return (
      <CondicaoRamosForm
        data={node.data as CondicaoRamosData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }

  if (node.type === "instagram_story_respondido") {
    return (
      <StoryRespondidoForm
        data={node.data as Parameters<typeof StoryRespondidoForm>[0]["data"]}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }
  // Gatilhos de comentário do Instagram: palavras, modo de comparação e escolha da publicação.
  if (node.type === "comentario_instagram" || node.type === "instagram_resposta_comentario") {
    return (
      <ComentarioInstagramForm
        data={node.data as Parameters<typeof ComentarioInstagramForm>[0]["data"]}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }
  // De qual formulário este robô atende. Ver `formulario-do-gatilho.ts`: sem esta escolha, todo
  // robô de formulário responde a todo formulário.
  if (node.type === "formulario_preenchido") {
    return (
      <FormularioPreenchidoForm
        data={node.data as { formularioId?: string }}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }
  if (node.type === "reagir_mensagem") {
    return <ReagirMensagemForm data={node.data as ReagirMensagemData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "encerrar_fluxo") {
    return <EncerrarFluxoForm data={node.data as EncerrarFluxoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "atualizar_campo") {
    return <AtualizarCampoForm data={node.data as AtualizarCampoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "executar_robo") {
    return (
      <ExecutarRoboForm
        data={node.data as ExecutarRoboData}
        area={area}
        fluxoAtualId={fluxoAtualId}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }
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
  if (node.type === "distribuir_disponibilidade") {
    return <DistribuirDisponibilidadeForm data={node.data as DistribuirDisponibilidadeData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
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
  if (node.type === "distribuir_sorteio") {
    return (
      <DistribuirSorteioForm
        data={node.data as DistribuirSorteioData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
      />
    );
  }

  if (node.type === "decisao_multipla") {
    return (
      <DecisaoMultiplaForm
        data={node.data as DecisaoMultiplaData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
        onRemoverCaminho={(caminhoId) => onRemoverOpcaoAresta(node.id, caminhoId)}
      />
    );
  }
  if (node.type === "ia_classificar") {
    return (
      <IaClassificarForm
        data={node.data as IaClassificarData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
        onRemoverCategoria={(categoria) => onRemoverOpcaoAresta(node.id, categoria)}
      />
    );
  }
  if (node.type === "encaminhar_humano") {
    return <EncaminharHumanoForm data={node.data as EncaminharHumanoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "cancelar_agendamento") {
    return <CancelarAgendamentoForm data={node.data as CancelarAgendamentoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "mensagem_contato") {
    return <MensagemContatoForm data={node.data as MensagemContatoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "mensagem_localizacao") {
    return <MensagemLocalizacaoForm data={node.data as MensagemLocalizacaoData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.type === "mensagem_email") {
    return <MensagemEmailForm data={node.data as MensagemEmailData} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (TIPOS_OPCOES.has(node.type)) {
    return (
      <MensagemOpcoesForm
        area={area}
        data={node.data as MensagemBotoesData}
        onChange={(d) => onUpdateNodeData(node.id, d)}
        onRemoverOpcao={(opcaoId) => onRemoverOpcaoAresta(node.id, opcaoId)}
      />
    );
  }
  if (TIPOS_MIDIA.has(node.type)) {
    return <MensagemMidiaForm node={node} area={area} onChange={(d) => onUpdateNodeData(node.id, d)} />;
  }
  if (node.category === "mensagem") {
    return (
      <MensagemForm
        node={node}
        area={area}
        onChange={(d) => onUpdateNodeData(node.id, d)}
        onTrocarTipo={onTrocarTipo}
      />
    );
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
  onTrocarTipo,
  onSelecionarNode,
  abaPedida,
  ehSocial,
  onAbrirGatilhos,
  onFechar,
  onSalvar,
  temPendencia,
}: {
  fluxo: FluxoAutomacao;
  selectedNodes: FlowNode[];
  problemas: ProblemaValidacao[];
  onUpdateFluxoMeta: (patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) => void;
  onUpdateConfiguracoes: (patch: Partial<ConfiguracoesFluxo>) => void;
  onUpdateNode: (nodeId: string, patch: Partial<Pick<FlowNode, "titulo" | "observacao">>) => void;
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onRemoverOpcaoAresta: (nodeId: string, opcaoId: string) => void;
  /** Troca o tipo do bloco. É o que transforma uma mensagem de texto em pergunta com botões. */
  onTrocarTipo?: (nodeId: string, tipo: FlowNodeType, data: Record<string, unknown>) => void;
  onSelecionarNode: (nodeId: string) => void;
  /**
   * O PAINEL ABERTO JÁ NUMA ABA, a pedido de quem está no canvas.
   *
   * É o que o "!" do bloco faz: clicar no alerta leva direto à lista de pendências DAQUELE bloco,
   * em vez de abrir "Configurar" e deixar a pessoa procurar a aba. O `token` é o que distingue
   * dois pedidos seguidos pela mesma aba — sem ele, pedir "problemas" depois de a pessoa ter
   * voltado pra "Configurar" na mão não mudaria nada.
   */
  abaPedida?: { aba: "configurar" | "problemas"; token: number };
  /**
   * NO SOCIAL SELLER O PAINEL TEM OUTRA CABEÇA.
   *
   * No funil ele abre com duas abas — "Configurar" e "Problemas" — porque um fluxo comercial tem
   * vinte blocos e a lista de pendências é metade do trabalho. Numa automação de Instagram de seis
   * blocos, a aba "Problemas" fica vazia quase sempre, e duas abas em cima de um formulário de
   * três campos são dois cliques pra decidir nada. Aqui o painel abre direto no bloco, com o nome
   * dele no topo, um X pra fechar e o Salvar no rodapé.
   *
   * As pendências não se perdem: elas continuam no cabeçalho do editor, que é onde não dá pra
   * sair da tela sem ver.
   */
  ehSocial?: boolean;
  /** Abre a gaveta dos gatilhos: no Social Seller é lá que palavra-chave e alcance moram. */
  onAbrirGatilhos?: () => void;
  onFechar?: () => void;
  onSalvar?: () => void;
  temPendencia?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const [aba, setAba] = useState<"configurar" | "problemas">("configurar");
  // Ajustar estado DURANTE o render quando a prop muda é o jeito que o React documenta pra isto —
  // e o único que não é um `useEffect` que escreve estado, que a regra do compilador proíbe.
  const [ultimoPedido, setUltimoPedido] = useState<number | undefined>(abaPedida?.token);
  if (abaPedida && abaPedida.token !== ultimoPedido) {
    setUltimoPedido(abaPedida.token);
    setAba(abaPedida.aba);
  }
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const { funis } = useFunis();

  /** O nome do bloco aberto, que vira o título do painel no Social Seller. */
  const tituloSocial = node
    ? node.titulo || BLOCOS_DISPONIVEIS.find((b) => b.tipo === node.type)?.label || node.type
    : traduzir("Configurações da automação");

  return (
    <aside className={`flow-config${ehSocial ? " flow-config-social" : ""}`} aria-label={traduzir("Painel de configuração")}>
      {ehSocial ? (
        <header className="cfg-topo">
          <h2>{traduzir(tituloSocial)}</h2>
          {onFechar ? (
            <button type="button" className="cfg-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
              <IconClose width={14} height={14} />
            </button>
          ) : null}
        </header>
      ) : null}

      {ehSocial ? null : (
      <div className="flow-config-tabs">
        <button type="button" className={`flow-tab${aba === "configurar" ? " on" : ""}`} onClick={() => setAba("configurar")}>
          {traduzir("Configurar")}
        </button>
        <button type="button" className={`flow-tab${aba === "problemas" ? " on" : ""}`} onClick={() => setAba("problemas")}>
          Problemas{problemas.length > 0 ? ` (${problemas.length})` : ""}
        </button>
      </div>
      )}

      <div className="flow-config-body">
        {aba === "problemas" && !ehSocial ? (
          <div className="flow-form">
            {problemas.length === 0 ? (
              <p className="hint">{traduzir("Nenhum problema encontrado: esse fluxo está pronto pra publicar.")}</p>
            ) : (
              problemas.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`flow-problema${p.severidade === "erro" ? " erro" : " aviso"}`}
                  onClick={() => p.nodeId && onSelecionarNode(p.nodeId)}
                  disabled={!p.nodeId}
                >
                  <span className="flow-problema-sev">
                    {p.severidade === "erro" ? <IconErro width={13} height={13} /> : <IconAlerta width={13} height={13} />}
                  </span>
                  <span>{p.mensagem}</span>
                </button>
              ))
            )}
          </div>
        ) : node ? (
          <>
            {/*
              A ESCOLHA DO FORMATO, no topo e só no Social Seller.
              
              No CRM cada formato de mensagem é um TIPO de bloco, e escolher o formato era escolher
              o bloco certo lá no menu do "+": decidir antes de abrir. Aqui a lista fica dentro do
              bloco, que é onde a pergunta "texto ou áudio?" aparece — olhando a conversa que está
              sendo montada, e não o menu.
            */}
            {ehSocial && onTrocarTipo && FORMATOS_DE_MENSAGEM.includes(node.type) ? (
              <EscolhaDeConteudo
                tipoAtual={node.type}
                onEscolher={(tipo, dados) => {
                  if (tipo !== node.type) onTrocarTipo(node.id, tipo, dados);
                }}
              />
            ) : null}

            {ehSocial ? null : (
            <div className="panel-h">
              <h4>{node.titulo || node.type}</h4>
            </div>
            )}
            <div className="flow-form">
              <div className="field">
                <label>
                  {traduzir("Título do bloco")}
                  <Ajuda texto={traduzir("O nome que aparece no cartão, no desenho. Em branco, vale o nome do tipo de bloco.")} />
                </label>
                <input
                  className="input"
                  placeholder={node.type}
                  value={node.titulo ?? ""}
                  onChange={(e) => onUpdateNode(node.id, { titulo: e.target.value })}
                />
              </div>
              <div className="field">
                <label>
                  {traduzir("Observação")}
                  <Ajuda texto={traduzir("Só pra sua equipe: fica guardada no bloco e nunca é enviada pro contato.")} />
                </label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                  value={node.observacao ?? ""}
                  onChange={(e) => onUpdateNode(node.id, { observacao: e.target.value })}
                />
              </div>
            </div>
            {/*
              "O QUE ESTE BLOCO FARÁ" VIROU UM "?" NO CABEÇALHO.
              
              Era uma seção inteira no fim do painel — título, divisória e um parágrafo — pra uma
              frase que a pessoa lê uma vez e nunca mais. Ela continua lá, no mesmo lugar onde
              está a pergunta ("o que isto aqui faz?"), só que sob demanda.
            */}
            <div className="panel-h divided">
              <h4>{traduzir("Configuração")}</h4>
              <Ajuda texto={resumoNaturalNo(node, funis)} />
            </div>
            <FormularioDoNode node={node} area={fluxo?.area ?? "comercial"} fluxoAtualId={fluxo?.id} onTrocarTipo={onTrocarTipo} onUpdateNodeData={onUpdateNodeData} onRemoverOpcaoAresta={onRemoverOpcaoAresta} onAbrirGatilhos={onAbrirGatilhos} />
          </>
        ) : selectedNodes.length > 1 ? (
          <p className="hint">{selectedNodes.length} blocos selecionados: selecione um só pra configurar, ou nenhum pra ver as configurações gerais do fluxo.</p>
        ) : (
          <>
            <div className="panel-h">
              <h4>{traduzir("Configurações gerais")}</h4>
            </div>
            <ConfiguracoesGeraisForm fluxo={fluxo} onChange={onUpdateFluxoMeta} onChangeConfiguracoes={onUpdateConfiguracoes} />
          </>
        )}
      </div>

      {/*
        O SALVAR NO RODAPÉ, como na referência. Ele não é um botão decorativo: chama a mesma
        gravação do cabeçalho do editor. Fica apagado quando não há nada pendente, porque um botão
        sempre aceso que às vezes não faz nada ensina a ignorá-lo.
      */}
      {ehSocial && onSalvar ? (
        <footer className="cfg-rodape">
          <button type="button" className="cfg-salvar" disabled={!temPendencia} onClick={onSalvar}>
            {traduzir("Salvar")}
            <IconCheck width={13} height={13} aria-hidden="true" />
          </button>
        </footer>
      ) : null}
    </aside>
  );
}
