"use client";

import { useMemo, useRef, useState } from "react";

import {
  IconAutomacoes,
  IconBandeira,
  IconClose,
  IconConfiguracoes,
  IconConversas,
  IconEquipe,
  IconPlug,
  IconRamificacao,
  IconRelogio,
} from "@/components/icons";
import { BLOCOS_DISPONIVEIS, GRUPOS_BIBLIOTECA } from "@/lib/automation-flow/blocos";
import { blocoApareceNaArea, blocoValeNaArea, type AreaAutomacao } from "@/lib/canais/capacidades";
import { separarPrimeirosPassos, sugestoesApos } from "@/lib/automation-flow/sugestoes";
import type { PosicaoDaLista } from "@/lib/automation-flow/posicao-da-lista";
import type { FlowNodeCategory, FlowNodeType } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * "Adicionar próximo passo": o painel que abre pela DIREITA quando se clica no "+" de uma saída.
 *
 * Era um modal no meio da tela. Um modal esconde justamente o que a pessoa precisa ver enquanto
 * escolhe: de qual bloco a seta está saindo, e o que já vem antes. Pela direita, o fluxo continua
 * visível e a escolha acontece olhando pro desenho.
 *
 * As sugestões vêm primeiro porque, na maioria das vezes, o próximo passo é um punhado de
 * possibilidades óbvias depois do bloco atual. A lista completa fica logo abaixo, agrupada, pra
 * quem quer outra coisa. Uma busca resolve os dois casos quando a pessoa já sabe o nome.
 */
/** O mesmo ícone que o bloco vai ter no canvas: escolher e reconhecer depois é o mesmo desenho. */
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

/** Uma linha da lista. Em componente porque agora ela é desenhada em dois lugares: os envios que
 * vêm primeiro e o resto da biblioteca, com o atalho de follow-up entre os dois. */
function ItemDoPasso({
  bloco,
  onEscolher,
}: {
  bloco: (typeof BLOCOS_DISPONIVEIS)[number];
  onEscolher: (tipo: FlowNodeType) => void;
}) {
  const Icone = ICONE_CATEGORIA[bloco.categoria];
  return (
    <button type="button" className="pp-item" onClick={() => onEscolher(bloco.tipo)}>
      <span className="pp-item-icone">
        <Icone width={16} height={16} />
      </span>
      <span className="pp-item-textos">
        <strong>{bloco.label}</strong>
        {bloco.descricao ? <span>{bloco.descricao}</span> : null}
      </span>
    </button>
  );
}

export function PainelProximoPasso({
  tipoAnterior,
  categoriaAnterior,
  area,
  rotuloDaSaida,
  onEscolher,
  onFollowUp,
  onFechar,
  compacto,
  juntoAoInicio,
  posicao,
  fioVerde,
}: {
  tipoAnterior?: FlowNodeType;
  categoriaAnterior?: FlowNodeCategory;
  /** Comercial ou social: o que o canal desta área não entrega, não aparece aqui. */
  area: AreaAutomacao;
  /** De qual saída o passo vai sair ("Sim", "1 · Quero agendar"). Fica no cabeçalho. */
  rotuloDaSaida?: string;
  onEscolher: (tipo: FlowNodeType) => void;
  /** O par pronto de espera + cobrança. É o caminho mais pedido depois de uma pergunta. */
  onFollowUp: () => void;
  onFechar: () => void;
  /**
   * A VERSÃO DO SOCIAL SELLER: uma caixinha flutuante, não uma gaveta de altura cheia.
   *
   * Uma gaveta é a forma certa no funil, onde a lista tem dez grupos e sessenta blocos e se passa
   * um tempo procurando. Aqui são poucos blocos e a escolha é de um segundo: a caixa aparece ao
   * lado do canvas, com o fluxo inteiro à vista atrás dela, e a lista vai corrida — sem cabeçalho
   * de grupo, que com três blocos por grupo ocupa mais linha que os próprios blocos.
   */
  compacto?: boolean;
  /**
   * AO LADO DA PASTILHA DE INÍCIO, e não no canto da tela.
   *
   * Vale pro quadro vazio: ali o enquadramento centraliza a única peça que existe, a pastilha
   * "Iniciar robô", e a lista precisa nascer colada nela — que é o desenho da referência. No
   * resto do tempo a caixa fica no canto, longe do bloco que se está editando de propósito, pra
   * não cobrir justamente a saída de onde o passo novo vai sair.
   */
  juntoAoInicio?: boolean;
  /** Em pixels de tela, quando a lista é chamada por um "+" de bloco. Ver o comentário no editor. */
  /** Onde a caixa nasce, em pixels de tela, e de que lado o fio sai (`posicao-da-lista.ts`). */
  posicao?: PosicaoDaLista;
  /** Fio na cor do começo: é o que liga a caixa à pastilha verde "Iniciar robô". */
  fioVerde?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const [busca, setBusca] = useState("");
  /*
   * A CAIXA SE MOVE.
   *
   * Ela nasce colada no "+" que a chamou, e às vezes é justamente ali que está o bloco que a
   * pessoa precisa ver pra decidir. Arrastar pelo cabeçalho tira a caixa da frente sem fechá-la
   * — fechar e reabrir noutro lugar não é possível, porque o lugar é sempre o do botão.
   *
   * O deslocamento é guardado À PARTE da posição de origem: assim reabrir num outro "+" volta a
   * nascer colada nele, em vez de herdar o arrasto da vez passada.
   */
  const [arrastado, setArrastado] = useState({ x: 0, y: 0 });
  const arrasteRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const termo = busca.trim().toLowerCase();

  const sugeridos = useMemo(
    () =>
      termo
        ? []
        : sugestoesApos(tipoAnterior, categoriaAnterior).filter((tipo) => blocoValeNaArea(tipo, area)),
    [termo, tipoAnterior, categoriaAnterior, area],
  );

  /** Gatilho não é "próximo passo": ele é o começo, e só pode existir um por fluxo. */
  const candidatos = useMemo(
    () => BLOCOS_DISPONIVEIS.filter((b) => b.categoria !== "gatilho" && blocoApareceNaArea(b, area)),
    [area],
  );

  const porGrupo = useMemo(() => {
    const filtrados = termo
      ? candidatos.filter(
          (b) => b.label.toLowerCase().includes(termo) || (b.descricao ?? "").toLowerCase().includes(termo),
        )
      : candidatos;
    return GRUPOS_BIBLIOTECA.map((grupo) => ({
      grupo,
      blocos: filtrados.filter((b) => b.grupo === grupo.id),
    })).filter((g) => g.blocos.length);
  }, [candidatos, termo]);

  /*
   * A LISTA CORRIDA SAI DOS CANDIDATOS, e não de `porGrupo`.
   *
   * `porGrupo` monta a lista percorrendo `GRUPOS_BIBLIOTECA` e filtrando por grupo — e os blocos
   * que entram nesta área POR EXCEÇÃO (etiqueta, campo do contato, executar outro robô) têm grupo
   * "crm", que não existe aqui. Eles passariam no filtro de candidatos e sumiriam na hora de
   * agrupar. Sem cabeçalho de grupo, agrupar não serve pra nada mesmo.
   */
  const corridos = useMemo(() => {
    const filtrados = termo
      ? candidatos.filter(
          (b) => b.label.toLowerCase().includes(termo) || (b.descricao ?? "").toLowerCase().includes(termo),
        )
      : candidatos;
    return filtrados;
  }, [candidatos, termo]);

  const { primeiros: itensPrimeiros, resto: itensRestantes } = useMemo(
    () => separarPrimeirosPassos(corridos),
    [corridos],
  );

  if (compacto) {
    const estilo = posicao
      ? { top: posicao.top + arrastado.y, left: posicao.left + arrastado.x }
      : undefined;
    return (
      <aside
        className={`pp-caixa${juntoAoInicio ? " pp-caixa-inicio" : ""}${posicao ? " pp-caixa-ancorada" : ""}`}
        style={estilo}
        role="dialog"
        aria-label={traduzir("Adicionar próximo passo")}
      >
        {/* A LINHA que liga a caixa a quem a abriu — o "+" de uma saída ou a pastilha "Iniciar
            robô". Sem ela, a caixa parece ter aparecido do nada e não se sabe de onde ela saiu.
            Quando a caixa não coube à direita e virou pra esquerda, o fio troca de lado: do
            contrário ele apontaria pro lado oposto de quem o chamou. */}
        {posicao ? (
          <span
            className={`pp-fio${posicao.fioNaDireita ? " pp-fio-direita" : ""}${fioVerde ? " pp-fio-inicio" : ""}`}
            aria-hidden="true"
          />
        ) : null}

        {/* O título estava só no `aria-label`: a caixa abria com um campo de busca e nenhuma
            palavra dizendo o que se está escolhendo. A referência abre com ele escrito. */}
        <div
          className={`pp-titulo${posicao ? " pp-titulo-arrastavel" : ""}`}
          onPointerDown={
            posicao
              ? (e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  arrasteRef.current = { x: e.clientX, y: e.clientY, baseX: arrastado.x, baseY: arrastado.y };
                }
              : undefined
          }
          onPointerMove={(e) => {
            const inicio = arrasteRef.current;
            if (!inicio) return;
            setArrastado({
              x: inicio.baseX + (e.clientX - inicio.x),
              y: inicio.baseY + (e.clientY - inicio.y),
            });
          }}
          onPointerUp={() => {
            arrasteRef.current = null;
          }}
        >
          <strong>{traduzir("Adicionar próximo passo")}</strong>
          {rotuloDaSaida ? <span>depois de &quot;{rotuloDaSaida}&quot;</span> : null}
        </div>
        <div className="pp-busca">
          <input
            className="input"
            placeholder={traduzir("Buscar")}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
          <button type="button" className="pp-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
            <IconClose width={13} height={13} />
          </button>
        </div>

        {/*
          OS ENVIOS PRIMEIRO, depois o atalho de follow-up, depois o resto.

          A lista vinha na ordem da biblioteca, que é ordem de catálogo: começava nas decisões e no
          sorteio, e "enviar uma mensagem" — o que se escolhe quase toda vez — ficava depois de
          rolar. Ver `separarPrimeirosPassos`.
        */}
        <div className="pp-lista">
          {itensPrimeiros.map((bloco) => (
            <ItemDoPasso key={bloco.tipo} bloco={bloco} onEscolher={onEscolher} />
          ))}

          {sugeridos.length ? (
            <button type="button" className="pp-item" onClick={onFollowUp}>
              <span className="pp-item-icone">
                <IconRelogio width={16} height={16} />
              </span>
              <span className="pp-item-textos">
                <strong>{traduzir("Adicionar follow-up")}</strong>
                <span>{traduzir("Espera 2 horas e, se não vier resposta, manda uma cobrança.")}</span>
              </span>
            </button>
          ) : null}

          {itensRestantes.map((bloco) => (
            <ItemDoPasso key={bloco.tipo} bloco={bloco} onEscolher={onEscolher} />
          ))}

          {!corridos.length ? <p className="hint pp-vazio">{traduzir("Nada com esse nome.")}</p> : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="proximo-passo" role="dialog" aria-label={traduzir("Adicionar próximo passo")}>
      <div className="proximo-passo-topo">
        <div>
          <strong>{traduzir("Adicionar próximo passo")}</strong>
          {rotuloDaSaida ? <span>depois de &quot;{rotuloDaSaida}&quot;</span> : null}
        </div>
        <button type="button" className="icon-btn subtle" aria-label={traduzir("Fechar")} onClick={onFechar}>
          <IconClose width={13} height={13} />
        </button>
      </div>

      <input
        className="input"
        placeholder={traduzir("Buscar passo…")}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoFocus
      />

      <div className="proximo-passo-lista">
        {sugeridos.length ? (
          <>
            <p className="proximo-passo-grupo">{traduzir("Sugeridos aqui")}</p>
            <button type="button" className="proximo-passo-item" onClick={onFollowUp}>
              <strong>{traduzir("Adicionar follow-up")}</strong>
              <span>{traduzir("Espera a resposta por 2 horas e, se não vier, manda uma cobrança.")}</span>
            </button>
            {sugeridos.map((tipo) => {
              const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
              if (!bloco) return null;
              return (
                <button
                  key={`sug-${tipo}`}
                  type="button"
                  className="proximo-passo-item"
                  onClick={() => onEscolher(tipo)}
                >
                  <strong>{bloco.label}</strong>
                  <span>{bloco.descricao}</span>
                </button>
              );
            })}
          </>
        ) : null}

        {porGrupo.map(({ grupo, blocos }) => (
          <div key={grupo.id}>
            <p className="proximo-passo-grupo">{grupo.label}</p>
            {blocos.map((bloco) => (
              <button
                key={bloco.tipo}
                type="button"
                className="proximo-passo-item"
                onClick={() => onEscolher(bloco.tipo)}
              >
                <strong>{bloco.label}</strong>
                <span>{bloco.descricao}</span>
              </button>
            ))}
          </div>
        ))}

        {!porGrupo.length ? <p className="hint">{traduzir("Nada com esse nome.")}</p> : null}
      </div>
    </aside>
  );
}
