"use client";

import { useMemo, useState } from "react";

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
import { sugestoesApos } from "@/lib/automation-flow/sugestoes";
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

export function PainelProximoPasso({
  tipoAnterior,
  categoriaAnterior,
  area,
  rotuloDaSaida,
  onEscolher,
  onFollowUp,
  onFechar,
  compacto,
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
}) {
  const { t: traduzir } = useIdioma();
  const [busca, setBusca] = useState("");
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

  if (compacto) {
    return (
      <aside className="pp-caixa" role="dialog" aria-label={traduzir("Adicionar próximo passo")}>
        {/* O título estava só no `aria-label`: a caixa abria com um campo de busca e nenhuma
            palavra dizendo o que se está escolhendo. A referência abre com ele escrito. */}
        <div className="pp-titulo">
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

        <div className="pp-lista">
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

          {corridos.map((bloco) => {
            const Icone = ICONE_CATEGORIA[bloco.categoria];
            return (
              <button key={bloco.tipo} type="button" className="pp-item" onClick={() => onEscolher(bloco.tipo)}>
                <span className="pp-item-icone">
                  <Icone width={16} height={16} />
                </span>
                <span className="pp-item-textos">
                  <strong>{bloco.label}</strong>
                  {bloco.descricao ? <span>{bloco.descricao}</span> : null}
                </span>
              </button>
            );
          })}

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
