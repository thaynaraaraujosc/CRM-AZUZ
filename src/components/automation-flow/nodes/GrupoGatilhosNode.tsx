"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import {
  IconAlerta,
  IconChave,
  IconExpandir,
  IconLixeira,
  IconRaio,
} from "@/components/icons";
import type { FlowRFNode } from "../utils";
import { useIdioma } from "@/lib/idioma-context";

/**
 * TODOS OS GATILHOS DA AUTOMAÇÃO NUM CARTÃO SÓ.
 *
 * O motor guarda UM BLOCO POR GATILHO, e com razão: cada um tem configuração própria (o de
 * comentário escolhe a publicação, o de story escolhe o story). Mas o canvas desenhava um cartão
 * por bloco, e marcar três gatilhos deixava três cartões empilhados, cada um com a sua linha
 * saindo pro mesmo primeiro passo. "Eu selecionei três gatilhos e ficou tudo separado. No do Gaio
 * eu escolhi quatro e ficou tudo dentro da mesma janela. Uma diferença gigantesca."
 *
 * Ela tem razão porque a pergunta é uma só: O QUE INICIA ESSA AUTOMAÇÃO. Três respostas pra mesma
 * pergunta são três linhas de uma lista, não três começos de fluxo — e desenhados como três
 * começos, o canvas passa a sugerir que existem três caminhos quando existe um.
 *
 * ESTE CARTÃO É UM BLOCO DE VERDADE, o primeiro gatilho do fluxo. Os outros continuam existindo,
 * salvos e ligados ao mesmo passo seguinte; eles só não são DESENHADOS (ver `gatilhosEscondidos`
 * no `FlowEditor`). Assim nada muda no motor, nas automações já publicadas nem nas execuções em
 * andamento: muda o desenho, que era o problema.
 *
 * SEM PALAVRA-CHAVE, QUALQUER MENSAGEM SERVE — e a linha diz isso em vez de ficar vazia. "Se eu
 * colocar uma palavra, é porque eu quero apenas quem comentou aquela palavra. Se eu não colocar,
 * é qualquer comentário."
 */
export default function GrupoGatilhosNode({ data, selected }: NodeProps<FlowRFNode>) {
  const { t: traduzir } = useIdioma();
  const {
    gatilhosDoGrupo = [],
    palavrasDoGrupo = [],
    aoAbrirGatilhos,
    aoAbrirPalavras,
    aoAdicionarGatilho,
    onAdicionarApos,
    saidasConectadas,
    aoDesligarSaida,
    aoRemover,
    problemas = [],
  } = data;

  const nomes = gatilhosDoGrupo.map((g) => traduzir(g.label));
  /* Os dois primeiros escritos e o resto num "+N": com quatro gatilhos, a lista inteira ocupa
     três linhas e o cartão deixa de caber na primeira olhada. É o que a referência faz. */
  const visiveis = nomes.slice(0, 2);
  const restantes = nomes.length - visiveis.length;
  const saidaConectada = saidasConectadas?.has("__default__") ?? false;

  return (
    <div className={`flow-node grupo-gatilhos${selected ? " is-selected" : ""}`}>
      {/*
        Ponto de chegada invisível: é onde o fio verde do "Iniciar robô" termina. Gatilho não
        recebe ligação, e sem nenhum ponto o React Flow não desenha a aresta.
      */}
      <Handle type="target" position={Position.Left} className="flow-handle flow-handle-ancora" isConnectable={false} />

      {problemas.length ? (
        <span className="flow-node-aba pendencia">
          <IconAlerta width={12} height={12} aria-hidden="true" />
          {problemas.length === 1
            ? traduzir("1 pendência a resolver")
            : traduzir("{n} pendências a resolver", { n: String(problemas.length) })}
          <span className="flow-node-pendencias" role="tooltip">
            {problemas.map((pr) => (
              <span key={pr.id}>{traduzir(pr.mensagem)}</span>
            ))}
          </span>
        </span>
      ) : selected ? (
        <span className="flow-node-aba selecionado">{traduzir("Selecionado")}</span>
      ) : (
        <span className="flow-node-aba">
          <IconRaio width={11} height={11} aria-hidden="true" /> {traduzir("Gatilho")}
        </span>
      )}

      {selected && aoRemover ? (
        <div className="flow-node-ferramentas">
          {aoRemover ? (
            <button
              type="button"
              className="perigo"
              aria-label={traduzir("Tirar todos os gatilhos")}
              title={traduzir("Tirar todos os gatilhos")}
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

      <div className="gg-cabeca">
        <span className="gg-canal">Instagram</span>
        <strong>{traduzir("O que inicia a automação")}</strong>
      </div>

      <button
        type="button"
        className="gg-linha nodrag"
        onClick={(e) => {
          e.stopPropagation();
          aoAbrirGatilhos?.();
        }}
        disabled={!aoAbrirGatilhos}
      >
        <span className="gg-icone" aria-hidden="true">
          <IconRaio width={16} height={16} />
        </span>
        <span className="gg-textos">
          <strong>{traduzir("Gatilhos ativos")}</strong>
          <span>{visiveis.join(", ") || traduzir("Nenhum gatilho escolhido")}</span>
        </span>
        {restantes > 0 ? <span className="gg-mais">+{restantes}</span> : null}
        <IconExpandir className="gg-seta" width={14} height={14} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="gg-linha nodrag"
        onClick={(e) => {
          e.stopPropagation();
          aoAbrirPalavras?.();
        }}
        disabled={!aoAbrirPalavras}
      >
        <span className="gg-icone" aria-hidden="true">
          <IconChave width={16} height={16} />
        </span>
        <span className="gg-textos">
          <strong>{traduzir("Palavras-chave")}</strong>
          <span className={palavrasDoGrupo.length ? undefined : "gg-vazio"}>
            {palavrasDoGrupo.length
              ? palavrasDoGrupo.join(", ")
              : traduzir("Qualquer mensagem serve")}
          </span>
        </span>
        <IconExpandir className="gg-seta" width={14} height={14} aria-hidden="true" />
      </button>

      {aoAdicionarGatilho ?? aoAbrirGatilhos ? (
        <button
          type="button"
          className="gg-adicionar nodrag"
          onClick={(e) => {
            e.stopPropagation();
            // O botão diz "Adicionar gatilho": ele abre a escolha, não o painel com o mesmo
            // botão de novo lá dentro.
            (aoAdicionarGatilho ?? aoAbrirGatilhos)?.();
          }}
        >
          {traduzir("Adicionar gatilho")} <span aria-hidden="true">+</span>
        </button>
      ) : null}

      <div className="flow-node-saida-unica">
        <span className="flow-node-proximo">{traduzir("Próximo passo")}</span>
        <Handle type="source" position={Position.Right} className="flow-handle" />
        {!saidaConectada && onAdicionarApos ? (
          <button
            type="button"
            className="flow-node-add-btn"
            title={traduzir("O que acontece agora?")}
            data-mais="__default__"
            onClick={(e) => {
              e.stopPropagation();
              onAdicionarApos(undefined, e.currentTarget.getBoundingClientRect());
            }}
          >
            +
          </button>
        ) : saidaConectada && aoDesligarSaida ? (
          <button
            type="button"
            className="flow-node-add-btn flow-node-tirar-ligacao"
            title={traduzir("Tirar a ligação desta saída")}
            onClick={(e) => {
              e.stopPropagation();
              aoDesligarSaida(undefined);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
