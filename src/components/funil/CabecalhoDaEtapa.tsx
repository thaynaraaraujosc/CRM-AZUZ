"use client";

import { useState } from "react";

import { IconClose } from "@/components/icons";
import { CORES_DA_ETAPA, ROTULO_DO_NIVEL } from "@/lib/funil/etapa-aparencia";
import type { DicasDaEtapa } from "@/lib/data";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O CABEÇALHO DE UMA ETAPA NA GRADE DE AUTOMAÇÃO.
 *
 * Três coisas que antes não existiam, e que a referência do Kommo tem desde sempre
 * (`docs/referencia-kommo-funil.md`):
 *
 * - a ALÇA pra reordenar a etapa arrastando;
 * - a COR escolhida, num círculo que abre a paleta;
 * - as DICAS: o que fazer quando um lead chega aqui, em três profundidades.
 *
 * As dicas são o que transforma o funil de um desenho numa instrução pra quem atende — e é por
 * isso que moram na etapa, e não num documento à parte que ninguém abre.
 */
export function CabecalhoDaEtapa({
  titulo,
  cor,
  corAutomatica,
  dicas,
  totalDeGatilhos,
  arrastando,
  podeEditar,
  aoComecarArraste,
  aoSoltarAqui,
  aoTerminarArraste,
  aoTrocarCor,
  aoSalvarDicas,
}: {
  titulo: string;
  /** A cor escolhida. Ausente = a automática, pela posição. */
  cor?: string;
  corAutomatica: string;
  dicas?: DicasDaEtapa;
  totalDeGatilhos: number;
  arrastando: boolean;
  /** Sem isto o cabeçalho é só leitura: é o caso do painel que abre dentro do quadro do funil. */
  podeEditar: boolean;
  aoComecarArraste: () => void;
  aoSoltarAqui: () => void;
  aoTerminarArraste: () => void;
  aoTrocarCor: (cor: string | null) => void;
  aoSalvarDicas: (dicas: DicasDaEtapa) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(false);
  const [sobre, setSobre] = useState(false);

  const quantasDicas = dicas ? Object.values(dicas).filter(Boolean).length : 0;

  return (
    <div
      className={`fauto-cab-cel${arrastando ? " arrastando" : ""}${sobre ? " alvo" : ""}`}
      onDragOver={(e) => {
        if (!podeEditar) return;
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        if (!podeEditar) return;
        e.preventDefault();
        setSobre(false);
        aoSoltarAqui();
      }}
    >
      <div className="fauto-cab-linha">
        {/*
          A ALÇA É O QUE SE ARRASTA, e não o cabeçalho inteiro.
          
          Com o cabeçalho inteiro arrastável, todo clique no nome vira um arraste de 2px e a tela
          treme. A alça diz onde pegar, e deixa o resto do cabeçalho livre pros outros botões.
        */}
        {podeEditar ? (
          <span
            className="fauto-cab-alca"
            draggable
            role="button"
            tabIndex={-1}
            aria-label={traduzir("Arrastar para reordenar {etapa}", { etapa: titulo })}
            title={traduzir("Arrastar para reordenar")}
            onDragStart={aoComecarArraste}
            onDragEnd={aoTerminarArraste}
          >
            <span aria-hidden="true" />
          </span>
        ) : null}

        <span className="fauto-cab-nome">{titulo}</span>

        {podeEditar ? (
          <span className="fauto-cab-cor-anchor">
            <button
              type="button"
              className="fauto-cab-cor"
              style={{ background: cor ?? corAutomatica }}
              aria-label={traduzir("Cor da etapa {etapa}", { etapa: titulo })}
              title={traduzir("Cor da etapa")}
              onClick={() => setPaletaAberta((v) => !v)}
            />
            {paletaAberta ? (
              <span className="fauto-paleta" role="dialog" aria-label={traduzir("Cor da etapa")}>
                {CORES_DA_ETAPA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`fauto-paleta-cor${cor === c ? " on" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => {
                      aoTrocarCor(c);
                      setPaletaAberta(false);
                    }}
                  />
                ))}
                {/* Voltar pra cor automática é diferente de escolher cinza: a automática acompanha
                    a posição, e é o estado de quem nunca escolheu nada. */}
                <button
                  type="button"
                  className="fauto-paleta-auto"
                  onClick={() => {
                    aoTrocarCor(null);
                    setPaletaAberta(false);
                  }}
                >
                  {traduzir("Cor automática")}
                </button>
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <span className="fauto-cab-barra" style={{ background: cor ?? corAutomatica }} />

      <div className="fauto-cab-pe">
        <span className="fauto-cab-sub">
          {totalDeGatilhos > 1
            ? traduzir("{n} gatilhos, nesta ordem", { n: String(totalDeGatilhos) })
            : totalDeGatilhos === 1
              ? traduzir("1 gatilho")
              : traduzir("Sem automação")}
        </span>
        {podeEditar ? (
          <button type="button" className="fauto-cab-dicas" onClick={() => setDicasAbertas(true)}>
            {quantasDicas
              ? traduzir("{n} dicas", { n: String(quantasDicas) })
              : traduzir("Adicionar dicas")}
          </button>
        ) : null}
      </div>

      {dicasAbertas ? (
        <DialogoDeDicas
          titulo={titulo}
          dicas={dicas}
          aoFechar={() => setDicasAbertas(false)}
          aoSalvar={(novas) => {
            aoSalvarDicas(novas);
            setDicasAbertas(false);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * O que fazer quando um lead chega nesta etapa, em três profundidades.
 *
 * Três e não um: quem entrou essa semana precisa do passo a passo, quem está há um ano precisa do
 * detalhe que só aparece em caso difícil. Num texto só, um dos dois é sempre mal servido — ou é
 * longo demais pra quem já sabe, ou curto demais pra quem não sabe.
 */
function DialogoDeDicas({
  titulo,
  dicas,
  aoFechar,
  aoSalvar,
}: {
  titulo: string;
  dicas?: DicasDaEtapa;
  aoFechar: () => void;
  aoSalvar: (dicas: DicasDaEtapa) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [rascunho, setRascunho] = useState<DicasDaEtapa>({ ...dicas });

  return (
    <div className="modal-overlay" onClick={aoFechar} role="presentation">
      <div
        className="modal fauto-dicas"
        role="dialog"
        aria-modal="true"
        aria-label={traduzir("Dicas da etapa {etapa}", { etapa: titulo })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-h">
          <h4>{traduzir("Dicas para a etapa “{etapa}”", { etapa: titulo })}</h4>
          <button type="button" className="modal-close-btn" aria-label={traduzir("Fechar")} onClick={aoFechar}>
            <IconClose width={13} height={13} />
          </button>
        </div>
        <div className="fauto-dicas-corpo">
          {(Object.keys(ROTULO_DO_NIVEL) as (keyof DicasDaEtapa)[]).map((nivel) => (
            <div className="field" key={nivel}>
              <label htmlFor={`dica-${nivel}`}>{traduzir(ROTULO_DO_NIVEL[nivel])}</label>
              <textarea
                id={`dica-${nivel}`}
                className="input"
                rows={3}
                maxLength={600}
                value={rascunho[nivel] ?? ""}
                placeholder={traduzir("O que fazer quando um lead chega aqui")}
                onChange={(e) => setRascunho({ ...rascunho, [nivel]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="section-foot">
          <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={aoFechar}>
            {traduzir("Cancelar")}
          </button>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => aoSalvar(rascunho)}>
            {traduzir("Salvar")}
          </button>
        </div>
      </div>
    </div>
  );
}
