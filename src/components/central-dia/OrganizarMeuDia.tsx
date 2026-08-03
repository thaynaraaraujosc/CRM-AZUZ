"use client";

import { useEffect, useState } from "react";

import { Drawer } from "@/components/ui";
import { useCentralDia } from "@/lib/central-dia-context";
import type { ItemDia } from "@/lib/central-dia/tipos";

const MODULO_LABEL: Record<ItemDia["modulo"], string> = {
  conversa: "Conversas",
  agenda: "Agenda",
  tarefa: "Tarefas",
  lead: "Funil",
  automacao: "Automações",
};

/** Tempo estimado mockado por módulo — só pra dar noção de esforço na sequência sugerida, nunca
 * calculado a partir de dado real (item 11 do pedido). */
const TEMPO_ESTIMADO: Record<ItemDia["modulo"], string> = {
  conversa: "5 min",
  agenda: "10 min",
  tarefa: "15 min",
  lead: "10 min",
  automacao: "20 min",
};

/**
 * Drawer "Organizar meu dia" (item 11) — monta uma sequência sugerida a partir dos itens urgentes/
 * que precisam de atenção, permite reordenar/remover antes de começar e, no modo execução, navegar
 * item a item (Anterior/Próximo/Concluir). Tudo em estado local do componente + `central-dia-context`
 * pra persistir a organização entre aberturas.
 */
export function OrganizarMeuDia({
  aberto,
  onFechar,
  itensSugeridos,
}: {
  aberto: boolean;
  onFechar: () => void;
  itensSugeridos: ItemDia[];
}) {
  const { iniciarOrganizacao, organizacao, avancarOrganizacao, voltarOrganizacao, cancelarOrganizacao, marcarConcluido, avisar } =
    useCentralDia();
  const [sequencia, setSequencia] = useState<ItemDia[]>(itensSugeridos.slice(0, 5));

  // Recalcula a sequência sempre que o drawer abre (com a lista corrente, já sem o que foi
  // resolvido/adiado enquanto estava fechado) — sem isso, `useState` só capturaria o instantâneo do
  // primeiro render da página e a sequência ficaria presa a itens que já saíram da lista principal.
  useEffect(() => {
    if (aberto && !organizacao) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSequencia(itensSugeridos.slice(0, 5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const emExecucao = !!organizacao;
  const itemAtual = emExecucao ? sequencia.find((i) => i.id === organizacao!.itens[organizacao!.indiceAtual]) : null;

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= sequencia.length) return;
    const nova = [...sequencia];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    setSequencia(nova);
  }

  function remover(id: string) {
    setSequencia((prev) => prev.filter((i) => i.id !== id));
  }

  function comecar() {
    iniciarOrganizacao(sequencia.map((i) => i.id));
  }

  function concluirAtual() {
    if (!itemAtual) return;
    marcarConcluido({
      itemId: itemAtual.id,
      titulo: itemAtual.titulo,
      tipo: itemAtual.tipo,
      horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      usuario: "Ana Ferreira",
      acao: "Concluído na organização do dia",
    });
    if (organizacao && organizacao.indiceAtual < organizacao.itens.length - 1) {
      avancarOrganizacao();
    } else {
      avisar("Sequência do dia concluída.");
      cancelarOrganizacao();
    }
  }

  return (
    <Drawer
      aberto={aberto}
      onFechar={onFechar}
      titulo="Organizar meu dia"
      subtitulo={emExecucao ? "Modo execução — siga a sequência sugerida" : "Sequência sugerida a partir do que precisa de atenção hoje"}
      rodape={
        emExecucao ? (
          <>
            <button type="button" className="btn ghost" disabled={organizacao!.indiceAtual === 0} onClick={voltarOrganizacao}>
              Anterior
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={organizacao!.indiceAtual >= organizacao!.itens.length - 1}
              onClick={avancarOrganizacao}
            >
              Próximo
            </button>
            <button type="button" className="btn primary" onClick={concluirAtual}>
              Concluir item
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={onFechar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => avisar("Organização do dia salva.")}
              disabled={sequencia.length === 0}
            >
              Salvar organização
            </button>
            <button type="button" className="btn primary" disabled={sequencia.length === 0} onClick={comecar}>
              Começar
            </button>
          </>
        )
      }
    >
      {sequencia.length === 0 ? (
        <p className="hint">Nenhum item pra organizar agora — tudo em dia por aqui.</p>
      ) : (
        <div className="central-dia-organizar-lista">
          {sequencia.map((item, i) => {
            const destacado = emExecucao && item.id === itemAtual?.id;
            return (
              <div key={item.id} className={`central-dia-organizar-item${destacado ? " is-atual" : ""}`}>
                <span className="central-dia-organizar-ordem">{i + 1}</span>
                <div className="central-dia-organizar-info">
                  <p className="n">{item.titulo}</p>
                  <p className="r">
                    {MODULO_LABEL[item.modulo]} · {TEMPO_ESTIMADO[item.modulo]} estimado ·{" "}
                    {item.prioridade === "urgente" ? "Urgente" : item.prioridade === "atencao" ? "Precisa de atenção" : "Oportunidade"}
                  </p>
                </div>
                {!emExecucao ? (
                  <div className="central-dia-organizar-acoes">
                    <button type="button" className="icon-btn subtle" aria-label="Mover pra cima" disabled={i === 0} onClick={() => mover(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn subtle"
                      aria-label="Mover pra baixo"
                      disabled={i === sequencia.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="remove-chip" aria-label="Remover etapa" onClick={() => remover(item.id)}>
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
