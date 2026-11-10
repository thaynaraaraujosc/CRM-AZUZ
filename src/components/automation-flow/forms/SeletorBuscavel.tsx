"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconCheck, IconSearch } from "@/components/icons";
import { ATRIBUTO_MENU_DE_LINHA, useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { filtrarOpcoes } from "@/lib/busca-de-opcoes";
import { useIdioma } from "@/lib/idioma-context";

/**
 * UM SELETOR COM BUSCA, GRUPOS E O ✓ NA OPÇÃO ATUAL.
 *
 * Por que não um `<select>`. A condição passou a oferecer quase cinquenta campos em seis grupos —
 * conversa, negócio, contato, rastreio, atividade e os que a própria empresa criou. Num `<select>`
 * nativo isso é uma lista rolante sem busca, onde achar "utm_campaign" é descer no olho até achar;
 * pior, um `<select>` cujo `value` não existe entre as `option` mostra em silêncio a PRIMEIRA
 * opção enquanto o dado continua outro — foi exatamente assim que a regra "Cliente enviar" passou
 * a aparecer como "Canal" na tela e como "Resposta do contato" na saída do bloco.
 *
 * O menu é portalizado em `document.body` com `position: fixed`: dentro do cartão ele seria
 * cortado pelo nó do canvas, que tem o seu próprio recorte e a sua própria escala.
 */

export type OpcaoBuscavel = {
  valor: string;
  label: string;
  grupo?: string;
  descricao?: string;
  /**
   * Termos que ACHAM esta opção sem aparecer nela.
   *
   * A busca olhava só o rótulo e o identificador, e por isso "começou a me seguir" não achava "É
   * seguidor" — o campo existia e parecia não existir. Os sinônimos consertam isso sem criar um
   * segundo nome na tela: entram no filtro, não no texto da opção.
   */
  sinonimos?: string[];
};

export function SeletorBuscavel({
  valor,
  opcoes,
  aoEscolher,
  className = "",
  placeholder,
  ariaLabel,
  larguraMinima = 240,
}: {
  valor: string;
  opcoes: OpcaoBuscavel[];
  aoEscolher: (valor: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  larguraMinima?: number;
}) {
  const { t: traduzir } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destacado, setDestacado] = useState(0);
  const gatilho = useRef<HTMLButtonElement>(null);
  const campoDeBusca = useRef<HTMLInputElement>(null);
  const [caixa, setCaixa] = useState<{ top: number; left: number; largura: number } | null>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    setBusca("");
  }, []);
  useFecharMenuDeLinha(aberto, fechar);

  const escolhida = opcoes.find((o) => o.valor === valor);

  /* O filtro mora em `lib/busca-de-opcoes`: é regra (rótulo, identificador, descrição e sinônimos),
     tem teste, e o próximo seletor com busca lê do mesmo lugar. */
  const filtradas = useMemo(() => filtrarOpcoes(opcoes, busca), [opcoes, busca]);

  /** As opções agrupadas, na ordem em que os grupos aparecem na lista. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, OpcaoBuscavel[]>();
    filtradas.forEach((o) => {
      const chave = o.grupo ?? "";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(o);
    });
    return Array.from(mapa.entries());
  }, [filtradas]);

  function abrir() {
    const r = gatilho.current?.getBoundingClientRect();
    if (r) {
      const largura = Math.max(r.width, larguraMinima);
      // Preso à janela: um menu que nasce com metade fora da tela é um menu que não abre.
      const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - largura - 8));
      const alturaEstimada = 320;
      const abaixo = r.bottom + 4;
      const top = abaixo + alturaEstimada > window.innerHeight ? Math.max(8, r.top - alturaEstimada - 4) : abaixo;
      setCaixa({ top, left, largura });
    }
    setDestacado(Math.max(0, filtradas.findIndex((o) => o.valor === valor)));
    setAberto(true);
  }

  useEffect(() => {
    if (aberto) campoDeBusca.current?.focus();
  }, [aberto]);

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setDestacado((d) => {
        const proximo = e.key === "ArrowDown" ? d + 1 : d - 1;
        return Math.max(0, Math.min(filtradas.length - 1, proximo));
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const alvo = filtradas[destacado];
      if (alvo) {
        aoEscolher(alvo.valor);
        fechar();
      }
    }
  }

  let indice = -1;

  return (
    <span className="sb-caixa" {...{ [ATRIBUTO_MENU_DE_LINHA]: "" }}>
      <button
        type="button"
        ref={gatilho}
        className={`sb-gatilho ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={(e) => {
          e.stopPropagation();
          if (aberto) fechar();
          else abrir();
        }}
      >
        <span className={`sb-valor${escolhida ? "" : " sb-vazio"}`}>
          {escolhida ? traduzir(escolhida.label) : (placeholder ?? traduzir("Selecione…"))}
        </span>
      </button>

      {aberto && caixa
        ? createPortal(
            <div
              className="sb-menu"
              style={{ top: caixa.top, left: caixa.left, width: caixa.largura }}
              {...{ [ATRIBUTO_MENU_DE_LINHA]: "" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sb-busca">
                <IconSearch width={13} height={13} aria-hidden="true" />
                <input
                  ref={campoDeBusca}
                  value={busca}
                  placeholder={traduzir("Buscar…")}
                  aria-label={traduzir("Buscar")}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setDestacado(0);
                  }}
                  onKeyDown={aoTeclar}
                />
              </div>
              <div className="sb-lista" role="listbox">
                {grupos.length === 0 ? <p className="sb-nada">{traduzir("Nada com esse nome.")}</p> : null}
                {grupos.map(([grupo, itens]) => (
                  <div className="sb-grupo" key={grupo || "_"}>
                    {grupo ? <p className="sb-grupo-nome">{traduzir(grupo)}</p> : null}
                    {itens.map((o) => {
                      indice += 1;
                      const meu = indice;
                      return (
                        <button
                          type="button"
                          key={o.valor}
                          role="option"
                          aria-selected={o.valor === valor}
                          className={`sb-opcao${o.valor === valor ? " on" : ""}${meu === destacado ? " destacada" : ""}`}
                          onMouseEnter={() => setDestacado(meu)}
                          onClick={(e) => {
                            e.stopPropagation();
                            aoEscolher(o.valor);
                            fechar();
                          }}
                        >
                          <span className="sb-tique">
                            {o.valor === valor ? <IconCheck width={12} height={12} /> : null}
                          </span>
                          <span className="sb-opcao-texto">
                            {traduzir(o.label)}
                            {o.descricao ? <em>{traduzir(o.descricao)}</em> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
