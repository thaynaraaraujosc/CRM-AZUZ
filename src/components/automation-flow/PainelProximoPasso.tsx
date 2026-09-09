"use client";

import { useMemo, useState } from "react";

import { IconClose } from "@/components/icons";
import { BLOCOS_DISPONIVEIS, GRUPOS_BIBLIOTECA } from "@/lib/automation-flow/blocos";
import { blocoValeNaArea, type AreaAutomacao } from "@/lib/canais/capacidades";
import { sugestoesApos } from "@/lib/automation-flow/sugestoes";
import type { FlowNodeCategory, FlowNodeType } from "@/lib/automation-flow/types";

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
export function PainelProximoPasso({
  tipoAnterior,
  categoriaAnterior,
  area,
  rotuloDaSaida,
  onEscolher,
  onFollowUp,
  onFechar,
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
}) {
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
    () => BLOCOS_DISPONIVEIS.filter((b) => b.categoria !== "gatilho" && blocoValeNaArea(b.tipo, area)),
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

  return (
    <aside className="proximo-passo" role="dialog" aria-label="Adicionar próximo passo">
      <div className="proximo-passo-topo">
        <div>
          <strong>Adicionar próximo passo</strong>
          {rotuloDaSaida ? <span>depois de &quot;{rotuloDaSaida}&quot;</span> : null}
        </div>
        <button type="button" className="icon-btn subtle" aria-label="Fechar" onClick={onFechar}>
          <IconClose width={13} height={13} />
        </button>
      </div>

      <input
        className="input"
        placeholder="Buscar passo…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoFocus
      />

      <div className="proximo-passo-lista">
        {sugeridos.length ? (
          <>
            <p className="proximo-passo-grupo">Sugeridos aqui</p>
            <button type="button" className="proximo-passo-item" onClick={onFollowUp}>
              <strong>Adicionar follow-up</strong>
              <span>Espera a resposta por 2 horas e, se não vier, manda uma cobrança.</span>
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

        {!porGrupo.length ? <p className="hint">Nada com esse nome.</p> : null}
      </div>
    </aside>
  );
}
