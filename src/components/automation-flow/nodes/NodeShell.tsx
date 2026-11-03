"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoIndicaIncompleto, resumoNo, saidasDoNo, temEntrada } from "@/lib/automation-flow/resumo";
import type { FlowNode as FlowNodeDominio, FlowNodeCategory } from "@/lib/automation-flow/types";
import { useFunis } from "@/lib/funis-context";
import type { FlowRFNode } from "../utils";
import { useIdioma } from "@/lib/idioma-context";
import {
  IconAlerta,
  IconAutomacoes,
  IconBandeira,
  IconConfiguracoes,
  IconConversas,
  IconEquipe,
  IconLampada,
  IconPlug,
  IconDuplicar,
  IconInstagram,
  IconLixeira,
  IconRaio,
  IconRamificacao,
  IconRelogio,
} from "@/components/icons";

/** Ícone por categoria de bloco. Eram emojis: cada um com desenho, peso e cor de uma fonte
 * diferente, e o conjunto nunca ia parecer uma família só. Agora saem todos da mesma biblioteca
 * do CRM: mesmo traço, mesma proporção, e herdam a cor do tema. */
const ICONE_CATEGORIA: Record<FlowNodeCategory, typeof IconAutomacoes> = {
  gatilho: IconAutomacoes,
  condicao: IconRamificacao,
  mensagem: IconConversas,
  espera: IconRelogio,
  acao: IconConfiguracoes,
  humano: IconEquipe,
  integracao: IconPlug,
  fim: IconBandeira,
};

/** Nome da categoria mostrado em cima do título. A leitura do tipo de bloco precisa funcionar sem abrir o nó. */
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
 * O TEXTO QUE A PESSOA DO OUTRO LADO VAI VER, quando o bloco manda um.
 *
 * O resumo do nó serve pra outra coisa: ele descreve o bloco ("texto · Canal: instagram", "2
 * opções"), entre aspas e truncado. Quem monta uma automação de Instagram precisa conferir o
 * contrário — a mensagem como ela chega no Direct. Por isso a bolha usa o texto CRU, com as
 * quebras de linha que foram escritas, e devolve `null` quando o bloco não manda texto nenhum
 * (uma espera, uma condição, uma etiqueta): aí o resumo continua sendo o que se mostra.
 */
function textoDaMensagem(node: FlowNodeDominio): string | null {
  const d = (node.data ?? {}) as Record<string, unknown>;
  const campo =
    node.type === "mensagem_texto" || node.type === "mensagem_botoes" || node.type === "mensagem_lista"
      ? d.texto
      : node.type === "mensagem_imagem" ||
          node.type === "mensagem_video" ||
          node.type === "mensagem_audio" ||
          node.type === "mensagem_documento"
        ? d.legenda
        : null;
  const texto = typeof campo === "string" ? campo.trim() : "";
  return texto ? texto : null;
}

/**
 * Renderizador único de nó, reaproveitado pelos 8 componentes registrados em
 * `nodeTypes` (um por `FlowNodeCategory`). A diferença visual/comportamental
 * entre tipos dentro da mesma categoria vem só de `saidasDoNo`/`resumoNo`,
 * então não faz sentido duplicar esse JSX 8 vezes.
 */
export function NodeShell({ id, data, selected }: NodeProps<FlowRFNode>) {
  const { t: traduzir } = useIdioma();
  const { flowNode, problemas, saidasConectadas, caminhosConvergindo, ordemNarrativa, explicacao, onAdicionarApos, area, aoDuplicar, aoRemover } =
    data;
  /*
   * A CARA DO INSTAGRAM só no Social Seller, e só nos blocos que falam com a rede.
   *
   * Gatilho e mensagem são os dois que tocam o Direct: um recebe o evento, o outro manda o texto.
   * Uma condição, uma espera ou uma etiqueta acontecem dentro do CRM e não têm nada de Instagram
   * — marcá-las com a marca da rede faria a marca querer dizer "bloco", e aí ela não diria nada.
   */
  const caraDoInstagram = area === "social" && (flowNode.category === "gatilho" || flowNode.category === "mensagem");
  const bolha = area === "social" ? textoDaMensagem(flowNode) : null;
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

      {/*
        AS ABAS DE CIMA, só no Social Seller.
        
        "Gatilho" numa aba escura acima do cartão e "Selecionado" numa aba azul no lugar dela.
        Vêm de fora da borda porque o cartão inteiro é conteúdo: a aba diz O QUE ele é e em que
        estado está sem gastar uma linha de dentro — e num canvas com oito blocos, achar o que
        começa tudo vira um relance em vez de uma leitura.
      */}
      {/*
        COPIAR E APAGAR EM CIMA DO BLOCO SELECIONADO.
        
        Antes os dois caminhos eram o menu do botão direito e a tecla Delete — nenhum dos dois se
        descobre olhando. Com o bloco selecionado, os dois ficam onde a pessoa acabou de clicar.
      */}
      {area === "social" && selected && (aoDuplicar || aoRemover) ? (
        <div className="flow-node-ferramentas">
          {aoDuplicar ? (
            <button
              type="button"
              aria-label={traduzir("Duplicar este bloco")}
              title={traduzir("Duplicar este bloco")}
              onClick={(e) => {
                e.stopPropagation();
                aoDuplicar();
              }}
            >
              <IconDuplicar width={14} height={14} />
            </button>
          ) : null}
          {aoRemover ? (
            <button
              type="button"
              className="perigo"
              aria-label={traduzir("Apagar este bloco")}
              title={traduzir("Apagar este bloco")}
              onClick={(e) => {
                e.stopPropagation();
                aoRemover();
              }}
            >
              <IconLixeira width={14} height={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      {area === "social" ? (
        selected ? (
          <span className="flow-node-aba selecionado">{traduzir("Selecionado")}</span>
        ) : flowNode.category === "gatilho" ? (
          <span className="flow-node-aba">
            <IconRaio width={11} height={11} aria-hidden="true" /> {traduzir("Gatilho")}
          </span>
        ) : null
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
        <span className={`flow-node-icon${caraDoInstagram ? " is-instagram" : ""}`} aria-hidden="true">
          {(() => {
            if (caraDoInstagram) return <IconInstagram width={16} height={16} />;
            const IconeCategoria = ICONE_CATEGORIA[flowNode.category];
            return <IconeCategoria width={14} height={14} />;
          })()}
        </span>
        <span className="flow-node-textos">
          <span className="flow-node-categoria">{NOME_CATEGORIA[flowNode.category]}</span>
          <span className="flow-node-label">{flowNode.titulo || (bloco?.label ? traduzir(bloco.label) : flowNode.type)}</span>
        </span>
        {flowNode.desativado ? <span className="flow-node-pausado-badge">{traduzir("Pausado")}</span> : null}
        {temErro || temAviso ? (
          <span
            className="flow-node-warn"
            title={problemas.map((p) => p.mensagem).join(" · ")}
            aria-label={`Problema: ${problemas[0]?.mensagem ?? ""}`}
          >
            <IconAlerta width={13} height={13} />
          </span>
        ) : null}
      </div>

      {bolha ? (
        /* A mensagem como ela chega no Direct: bolha, texto cru, quebras de linha preservadas. */
        <div className="flow-node-body">
          <p className="flow-bolha">{bolha}</p>
        </div>
      ) : (
        (() => {
          const resumo = resumoNo(flowNode, funis);
          const incompleto = resumoIndicaIncompleto(resumo);
          return (
            <div className={`flow-node-body${incompleto ? " flow-node-body-incompleto" : ""}`}>
              {incompleto ? (
                <span aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 4 }}>
                  <IconAlerta width={12} height={12} />
                </span>
              ) : null}
              {resumo}
            </div>
          );
        })()
      )}

      {explicacao ? (
        <div className="flow-node-explicacao">
          <IconLampada width={12} height={12} aria-hidden="true" /> {explicacao}
        </div>
      ) : null}

      {saidas.length > 1 ? (
        <div className="flow-node-handles">
          {saidas.map((s) => {
            const chave = s.handleId ?? "__default__";
            const conectada = saidasConectadas?.has(chave) ?? false;
            /* Condição binária (item 8): "Sim"/"Não" tem que ler como uma bifurcação clara, não só
               mais uma linha de opção igual às outras. Verde/vermelho reforça qual caminho é qual
               sem precisar ler o texto. */
            const corBifurcacao = flowNode.category === "condicao" ? (chave === "sim" ? "sim" : chave === "nao" ? "nao" : undefined) : undefined;
            /* Pergunta com várias opções (item 8): visual de "menu" (pill azulado). Diferente da
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
                <span className="flow-handle-label">{traduzir(s.label)}</span>
                {!conectada && onAdicionarApos ? (
                  <button
                    type="button"
                    className="flow-node-add-inline"
                    title={traduzir("O que acontece agora?")}
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
          {/* "Próximo passo" escrito: o ponto de conexão sozinho não diz o que ele é, e quem
              nunca montou um fluxo não descobre que se arrasta dali pra ligar no bloco seguinte. */}
          <span className="flow-node-proximo">{traduzir("Próximo passo")}</span>
          <Handle type="source" position={Position.Bottom} className="flow-handle" />
          {!(saidasConectadas?.has("__default__") ?? false) && onAdicionarApos ? (
            <button
              type="button"
              className="flow-node-add-btn"
              title={traduzir("O que acontece agora?")}
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
