"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * AS PEÇAS QUE ESTÃO RODANDO NESTA CAMPANHA.
 *
 * "Quando eu passo o mouse em cima da miniatura, tem como ver todos os criativos que existem
 * dentro daquela campanha? Eu tenho alguns conjuntos lá, cada conjunto tem 3 criativos, e aqui só
 * tá mostrando o primeiro."
 *
 * Tem, e sem nenhuma chamada a mais: a consulta de anúncios já trazia a conta inteira e o código
 * é que descartava tudo menos o primeiro de cada campanha (ver o comentário na rota). Na linha
 * continua um quadradinho só — doze imagens por linha viraria uma parede —, e o resto aparece ao
 * passar o mouse, que é quando a pergunta "quais peças são essas?" de fato acontece.
 *
 * O PAINEL VIVE NO `body`, em coordenadas de tela. Dentro da tabela ele seria cortado pelo
 * `overflow` do `.table-wrap` na primeira e na última linha — justamente onde se passa o mouse
 * primeiro. É o mesmo caminho que o balão de ajuda do CRM já faz, e pelo mesmo motivo.
 */

export type Criativo = { url: string; nome: string };

export function CriativosDaCampanha({ criativos, campanha }: { criativos: Criativo[]; campanha: string }) {
  const alvoRef = useRef<HTMLSpanElement>(null);
  const [painel, setPainel] = useState<{ top: number; left: number; abaixo: boolean } | null>(null);

  const primeiro = criativos[0];

  // Sem peça nenhuma, o lugar continua ocupado: linha com foto e linha sem foto desalinhariam a
  // coluna do nome, e a tabela passaria a parecer torta em vez de incompleta.
  if (!primeiro) return <span className="trafego-foto trafego-foto-vazia" aria-hidden="true" />;

  function abrir() {
    const alvo = alvoRef.current?.getBoundingClientRect();
    if (!alvo) return;
    const largura = 268;
    const margem = 12;
    const left = Math.min(Math.max(margem, alvo.left - 8), window.innerWidth - margem - largura);
    // Abre pra baixo quando está perto do topo, pra cima quando está perto do rodapé: nas duas
    // pontas da tabela o painel sairia da janela se abrisse sempre pro mesmo lado.
    const abaixo = alvo.top < window.innerHeight / 2;
    setPainel({ top: abaixo ? alvo.bottom + 6 : alvo.top - 6, left, abaixo });
  }

  // Uma peça só não tem o que expandir: o painel mostraria a mesma imagem de novo, maior.
  const temMais = criativos.length > 1;

  return (
    <span
      ref={alvoRef}
      className="trafego-criativos"
      onMouseEnter={temMais ? abrir : undefined}
      onMouseLeave={() => setPainel(null)}
      /* Teclado também: a tabela é navegável por tab, e um painel que só existe no mouse é um
         painel que metade das pessoas nunca vê. */
      tabIndex={temMais ? 0 : undefined}
      onFocus={temMais ? abrir : undefined}
      onBlur={() => setPainel(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="trafego-foto" src={primeiro.url} alt="" loading="lazy" />
      {temMais ? <span className="trafego-criativos-conta">{criativos.length}</span> : null}

      {painel && typeof document !== "undefined"
        ? createPortal(
            <span
              className={`trafego-criativos-painel${painel.abaixo ? " abaixo" : ""}`}
              role="tooltip"
              style={{ top: painel.top, left: painel.left }}
            >
              <span className="trafego-criativos-h">
                {criativos.length} peças em “{campanha}”
              </span>
              <span className="trafego-criativos-grade">
                {criativos.map((c) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c.url} src={c.url} alt="" title={c.nome} loading="lazy" />
                ))}
              </span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
