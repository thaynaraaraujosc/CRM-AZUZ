"use client";

import {
  IconAlerta,
  IconDesfazer,
  IconExpandir,
  IconHistorico,
  IconLampada,
  IconRefazer,
  IconRelatorios,
  IconVarinha,
  IconZoomMais,
  IconZoomMenos,
} from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A COLUNA DE FERRAMENTAS DO CANVAS, à direita.
 *
 * Zoom, desfazer, refazer e organizar moravam na barra de cima, a quarenta centímetros de onde a
 * mão está enquanto se arrasta um bloco. Numa coluna encostada na borda direita, o ponteiro sai
 * do bloco e chega na ferramenta — e a barra de cima volta a ter só o que é decisão (publicar),
 * não o que é manobra.
 *
 * O "+" é o único cheio e colorido: é a ação que faz a automação existir. Os outros são manobra, e
 * manobra não disputa atenção com conteúdo.
 */
export function BarraFerramentasSocial({
  podeDesfazer,
  podeRefazer,
  habilitado,
  entenderFluxoAtivo,
  onAdicionar,
  onZoomMais,
  onZoomMenos,
  onCentralizar,
  onDesfazer,
  onRefazer,
  onOrganizar,
  onExecucoes,
  onHistorico,
  onAlternarEntenderFluxo,
  problemas,
  problemasAbertos,
  onAlternarProblemas,
}: {
  podeDesfazer: boolean;
  podeRefazer: boolean;
  /** Fora do modo Construir, o que MUDA o fluxo fica desligado; o que só olha, não. */
  habilitado: boolean;
  entenderFluxoAtivo: boolean;
  onAdicionar: () => void;
  onZoomMais: () => void;
  onZoomMenos: () => void;
  onCentralizar: () => void;
  onDesfazer: () => void;
  onRefazer: () => void;
  onOrganizar: () => void;
  onExecucoes: () => void;
  onHistorico: () => void;
  onAlternarEntenderFluxo: () => void;
  /**
   * QUANTAS PENDÊNCIAS O ROBÔ TEM, pro contador do botão.
   *
   * O editor do funil tinha uma aba "Problemas" no painel da direita; o do Social Seller não tinha
   * lugar nenhum — a pendência aparecia só como etiqueta no bloco, e a que não é de bloco nenhum
   * ("nada dispara esta automação") não aparecia em canto algum até a publicação ser recusada.
   *
   * Agora os dois têm o mesmo lugar, e ele fica aqui: ao lado do quadro, não dentro do formulário
   * de um bloco.
   */
  problemas: number;
  problemasAbertos: boolean;
  onAlternarProblemas: () => void;
}) {
  const { t: traduzir } = useIdioma();

  return (
    <div className="ss-ferramentas">
      {/* Separado do resto, em cima: "entender fluxo" muda o que a tela MOSTRA, não o que ela faz.
          Misturado com zoom e desfazer, ele viraria mais um botão de manobra. */}
      <button
        type="button"
        className={`ss-ferramenta destaque${entenderFluxoAtivo ? " on" : ""}`}
        aria-pressed={entenderFluxoAtivo}
        title={traduzir("Numera os blocos na ordem em que acontecem e explica cada um")}
        aria-label={traduzir("Entender fluxo")}
        onClick={onAlternarEntenderFluxo}
      >
        <IconLampada width={16} height={16} />
      </button>

      {/* O contador some quando está tudo certo: um "0" permanente é ruído, e a ausência dele já
          diz o que precisa ser dito. O botão fica, pra quem quiser conferir. */}
      <button
        type="button"
        className={`ss-ferramenta destaque${problemasAbertos ? " on" : ""}${problemas > 0 ? " com-pendencia" : ""}`}
        aria-pressed={problemasAbertos}
        title={traduzir("O que falta pra publicar")}
        aria-label={traduzir("O que falta pra publicar")}
        onClick={onAlternarProblemas}
      >
        <IconAlerta width={16} height={16} />
        {problemas > 0 ? <span className="ss-ferramenta-contador">{problemas}</span> : null}
      </button>

      <div className="ss-ferramentas-grupo">
        <button
          type="button"
          className="ss-ferramenta principal"
          disabled={!habilitado}
          title={traduzir("Adicionar um bloco")}
          aria-label={traduzir("Adicionar um bloco")}
          onClick={onAdicionar}
        >
          <span aria-hidden="true">+</span>
        </button>

        <button type="button" className="ss-ferramenta" title={traduzir("Aproximar")} aria-label={traduzir("Aproximar")} onClick={onZoomMais}>
          <IconZoomMais width={16} height={16} />
        </button>
        <button type="button" className="ss-ferramenta" title={traduzir("Afastar")} aria-label={traduzir("Afastar")} onClick={onZoomMenos}>
          <IconZoomMenos width={16} height={16} />
        </button>
        <button
          type="button"
          className="ss-ferramenta"
          title={traduzir("Centralizar o fluxo")}
          aria-label={traduzir("Centralizar o fluxo")}
          onClick={onCentralizar}
        >
          <IconExpandir width={15} height={15} />
        </button>

        <hr className="ss-ferramentas-linha" />

        <button
          type="button"
          className="ss-ferramenta"
          disabled={!podeDesfazer || !habilitado}
          title={traduzir("Desfazer (Ctrl+Z)")}
          aria-label={traduzir("Desfazer")}
          onClick={onDesfazer}
        >
          <IconDesfazer width={16} height={16} />
        </button>
        <button
          type="button"
          className="ss-ferramenta"
          disabled={!podeRefazer || !habilitado}
          title={traduzir("Refazer (Ctrl+Shift+Z)")}
          aria-label={traduzir("Refazer")}
          onClick={onRefazer}
        >
          <IconRefazer width={16} height={16} />
        </button>
        <button
          type="button"
          className="ss-ferramenta"
          disabled={!habilitado}
          title={traduzir("Organizar automaticamente")}
          aria-label={traduzir("Organizar automaticamente")}
          onClick={onOrganizar}
        >
          <IconVarinha width={16} height={16} />
        </button>

        <hr className="ss-ferramentas-linha" />

        <button
          type="button"
          className="ss-ferramenta"
          title={traduzir("Execuções desta automação")}
          aria-label={traduzir("Execuções")}
          onClick={onExecucoes}
        >
          <IconRelatorios width={16} height={16} />
        </button>
        <button
          type="button"
          className="ss-ferramenta"
          title={traduzir("Histórico de versões")}
          aria-label={traduzir("Histórico de versões")}
          onClick={onHistorico}
        >
          <IconHistorico width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
