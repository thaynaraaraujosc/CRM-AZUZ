"use client";

import { useEffect, useRef, useState } from "react";

import { IconCalendar } from "@/components/icons";
import { SeletorDeData } from "@/components/seletor-de-data";
import { dataCurta } from "@/lib/agenda/fuso";
import { TETO_DE_DIAS } from "@/lib/social/recorte-do-periodo";
import { diasEntre } from "@/lib/agenda/fuso";
import { useIdioma } from "@/lib/idioma-context";

/**
 * ESCOLHER O PERÍODO À MÃO, e não só pelas pastilhas.
 *
 * "Dia, Semana, Mês, Trimestre" cobre a pergunta "como estamos indo", que é a de todo dia. Não
 * cobre "como foi a semana da campanha", "como foi outubro" ou "como foi desde que liguei o
 * robô" — que são perguntas com data marcada. O recorte escrito na barra deixou de ser só um
 * rótulo e virou o botão que abre as duas datas.
 *
 * O TETO DE 90 DIAS é avisado AQUI, antes de aplicar, e não corrigido em silêncio no servidor.
 * O servidor apara de qualquer jeito (ver `recorte-do-periodo.ts`) porque a URL é digitável; mas
 * quem pede seis meses e recebe três sem explicação fica achando que o CRM perdeu os dados.
 */
export function SeletorDePeriodo({
  primeiroDia,
  ultimoDia,
  personalizado,
  aoEscolher,
}: {
  primeiroDia: string;
  ultimoDia: string;
  /** Verdadeiro quando o recorte atual veio daqui, e não de uma pastilha. */
  personalizado: boolean;
  aoEscolher: (intervalo: { de: string; ate: string }) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(primeiroDia);
  const [ate, setAte] = useState(ultimoDia);
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;
      // O calendário de cada campo mora fora desta árvore (portal em `document.body`): sem esta
      // checagem, clicar num dia fecharia a caixa inteira antes de a data ser escolhida.
      if (caixaRef.current?.contains(alvo) || alvo.closest(".seletor-data-painel")) return;
      setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function abrir() {
    // Abre sempre no recorte que está na tela: é dele que se parte pra ajustar.
    setDe(primeiroDia);
    setAte(ultimoDia);
    setAberto(true);
  }

  const tamanho = diasEntre(de, ate);
  const problema =
    tamanho === 0
      ? traduzir("A data de início é depois da data de fim.")
      : tamanho > TETO_DE_DIAS
        ? traduzir("O período máximo é de {n} dias.", { n: String(TETO_DE_DIAS) })
        : null;

  return (
    <div className="ss-periodo-escolha" ref={caixaRef}>
      <button
        type="button"
        className={`ss-periodo-botao${personalizado ? " on" : ""}`}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        <IconCalendar width={13} height={13} aria-hidden="true" />
        {dataCurta(primeiroDia)}
        {primeiroDia === ultimoDia ? null : ` – ${dataCurta(ultimoDia)}`}
      </button>

      {aberto ? (
        <div className="ss-periodo-pop" role="dialog" aria-label={traduzir("Escolher o período")}>
          <div className="ss-periodo-campos">
            <div className="field">
              <label>{traduzir("De")}</label>
              <SeletorDeData valor={de} onChange={setDe} curto />
            </div>
            <div className="field">
              <label>{traduzir("Até")}</label>
              <SeletorDeData valor={ate} onChange={setAte} curto minimo={de} />
            </div>
          </div>

          {problema ? (
            <p className="hint" style={{ color: "var(--danger)" }}>
              {problema}
            </p>
          ) : (
            <p className="hint">
              {tamanho === 1
                ? traduzir("Um dia.")
                : traduzir("{n} dias.", { n: String(tamanho) })}
            </p>
          )}

          <div className="ss-periodo-fim">
            <button type="button" className="btn ghost pequeno" onClick={() => setAberto(false)}>
              {traduzir("Cancelar")}
            </button>
            <button
              type="button"
              className="btn primary pequeno"
              disabled={!!problema}
              onClick={() => {
                aoEscolher({ de, ate });
                setAberto(false);
              }}
            >
              {traduzir("Aplicar")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
