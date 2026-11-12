"use client";

import { useState, type ReactNode } from "react";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Primitivos de gráfico reutilizados em toda a Inteligência comercial.
 * Criados pra substituir os vários gráficos de pizza/lista/barra
 * redundantes que cada tela desenhava do zero. Cada gráfico aqui responde
 * a uma pergunta clara (ranking → BarList, evolução → LineChart, etapas →
 * FunnelSteps) em vez de "preencher espaço".
 */

/** Uma linha de ranking com barra + quantidade + percentual + valor, tudo junto: nunca 4 botões pra ver a mesma coisa de jeitos diferentes. */
export type BarRowItem = {
  chave: string;
  label: string;
  /** Texto já formatado: "2 perdas · 40% · R$ 4.100". Se não vier, é montado a partir de quantidade/percentual/valor. */
  meta?: string;
  quantidade?: number;
  percentual?: number;
  valorLabel?: string;
  cor?: string;
  onClick?: () => void;
};

export function BarList({
  items,
  corPadrao = "#2e6bff",
}: {
  items: BarRowItem[];
  corPadrao?: string;
}) {
  const maior = Math.max(1, ...items.map((i) => i.percentual ?? i.quantidade ?? 0));
  return (
    <div>
      {items.map((item) => {
        const largura = Math.max(
          4,
          ((item.percentual ?? item.quantidade ?? 0) / maior) * 100,
        );
        const meta =
          item.meta ??
          [
            item.quantidade !== undefined
              ? `${item.quantidade} ${item.quantidade === 1 ? "registro" : "registros"}`
              : null,
            item.percentual !== undefined ? `${item.percentual}%` : null,
            item.valorLabel,
          ]
            .filter(Boolean)
            .join(" · ");
        const Wrapper = item.onClick ? "button" : "div";
        return (
          <Wrapper
            key={item.chave}
            type={item.onClick ? "button" : undefined}
            className="camp-row"
            style={
              item.onClick
                ? { width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }
                : undefined
            }
            onClick={item.onClick}
          >
            <div className="camp-body">
              <p className="camp-name">{item.label}</p>
              <p className="hint" style={{ margin: "1px 0 4px" }}>{meta}</p>
              <div className="camp-track">
                <div
                  className="camp-fill"
                  style={{ width: `${largura}%`, background: item.cor ?? corPadrao }}
                />
              </div>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

export type SerieLinha = { chave: string; cor: string; label: string; pontos: { x: string; y: number }[] };

/** Gráfico de linha/área com até algumas séries e tooltip ao passar o mouse. Usado pra "evolução no período" em qualquer tela. */
export function LineChart({ series, altura = 200 }: { series: SerieLinha[]; altura?: number }) {
  const { t: traduzir } = useIdioma();
  const largura = 800;
  const n = series[0]?.pontos.length ?? 0;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maior = Math.max(1, ...series.flatMap((s) => s.pontos.map((p) => p.y)));
  const passo = n > 1 ? largura / (n - 1) : largura;

  function caminho(pontos: { x: string; y: number }[], area: boolean) {
    const linha = pontos
      .map((p, i) => {
        const x = i * passo;
        const y = altura - (p.y / maior) * (altura - 20) - 6;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    if (!area) return linha;
    return `${linha} L${largura},${altura} L0,${altura} Z`;
  }

  function aoMoverMouse(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRelativo = ((e.clientX - rect.left) / rect.width) * largura;
    const indice = Math.max(0, Math.min(n - 1, Math.round(xRelativo / passo)));
    setHoverIndex(indice);
  }

  if (n === 0) return <p className="hint">{traduzir("Sem dados suficientes no período.")}</p>;

  return (
    <div style={{ position: "relative" }}>
      {series.length > 1 ? (
        <p className="hint" style={{ marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {series.map((s) => (
            <span key={s.chave}>
              <span style={{ color: s.cor }}>●</span> {s.label}
            </span>
          ))}
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ width: "100%", height: altura, overflow: "visible", cursor: "crosshair" }}
        onMouseMove={aoMoverMouse}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {series.map((s) => (
          <path key={s.chave} d={caminho(s.pontos, true)} fill={s.cor} opacity={0.14} />
        ))}
        {series.map((s) => (
          <path key={`${s.chave}-linha`} d={caminho(s.pontos, false)} fill="none" stroke={s.cor} strokeWidth={2} />
        ))}
        {hoverIndex !== null ? (
          <line x1={hoverIndex * passo} x2={hoverIndex * passo} y1={0} y2={altura} stroke="var(--line)" strokeDasharray="3 3" />
        ) : null}
      </svg>
      {hoverIndex !== null ? (
        <div
          className="chart-tooltip"
          style={{ left: `${Math.min(88, Math.max(2, (hoverIndex / Math.max(1, n - 1)) * 100))}%` }}
        >
          <b>{series[0]?.pontos[hoverIndex]?.x}</b>
          {series.map((s) => (
            <div key={s.chave}>
              <span style={{ color: s.cor }}>●</span> {s.label}: {s.pontos[hoverIndex]?.y}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type EtapaFunilVisual = {
  chave: string;
  label: string;
  quantidade: number;
  valorLabel?: string;
  href?: string;
};

/**
 * Funil vertical: quantidade por etapa e quanto dela sobrou da etapa anterior.
 *
 * DUAS LINHAS POR ETAPA, NÃO TRÊS. "Essa parte do funil tá tomando muito espaço. Olha a distância
 * de uma linha para outra, não tem necessidade disso."
 *
 * Cada etapa gastava três linhas: rótulo e número em cima, a barra, e embaixo uma frase solta com
 * a retenção. Seis etapas viravam uma tela inteira pra mostrar seis números. A retenção subiu pra
 * linha do rótulo, que é onde ela se lê junto do que descreve, e a etapa passou a caber em duas.
 *
 * E A FRASE FICOU ESPECÍFICA. Era "100% da etapa anterior" — e era isso mesmo que estava escrito
 * seis vezes seguidas na conta dela, porque TODAS as etapas estavam zeradas e `0/0` virava 100%.
 * Dizer "100% da etapa anterior" sobre nada é a pior combinação possível: parece um resultado
 * ótimo. Agora a etapa anterior é chamada pelo nome ("75% de Novo"), e quando não há ninguém na
 * anterior não há retenção nenhuma pra mostrar — a frase some em vez de inventar 100%.
 */
export function FunnelSteps({ etapas, onClickEtapa }: { etapas: EtapaFunilVisual[]; onClickEtapa?: (chave: string) => void }) {
  const maior = Math.max(1, ...etapas.map((e) => e.quantidade));
  return (
    <div className="funnel-steps">
      {etapas.map((e, i) => {
        const etapaAnterior = i > 0 ? etapas[i - 1] : null;
        const anterior = etapaAnterior?.quantidade ?? e.quantidade;
        const percentualAnterior = anterior > 0 ? Math.round((e.quantidade / anterior) * 100) : 0;
        const perda = etapaAnterior ? Math.max(0, anterior - e.quantidade) : 0;
        const largura = Math.max(8, (e.quantidade / maior) * 100);
        const Wrapper: "button" | "div" = onClickEtapa ? "button" : "div";
        // Sem ninguém na etapa anterior não há o que reter: a retenção some em vez de virar 100%.
        const mostrarRetencao = etapaAnterior !== null && anterior > 0;
        return (
          <div className="funnel-step" key={e.chave}>
            <Wrapper
              type={onClickEtapa ? "button" : undefined}
              className="funnel-step-bar-wrap"
              onClick={onClickEtapa ? () => onClickEtapa(e.chave) : undefined}
              style={onClickEtapa ? { cursor: "pointer" } : undefined}
            >
              <div className="funnel-step-top">
                <span className="funnel-step-label">{e.label}</span>
                {mostrarRetencao && etapaAnterior ? (
                  <span
                    className="funnel-step-retencao"
                    data-retencao={percentualAnterior >= 70 ? "boa" : percentualAnterior >= 40 ? "atencao" : "critica"}
                    /* A frase inteira no título: na linha fica o resumo, aqui fica a conta. */
                    title={`${e.quantidade} dos ${anterior} que estavam em "${etapaAnterior.label}" chegaram a "${e.label}"${
                      perda > 0 ? `; ${perda} não avançaram` : ""
                    }`}
                  >
                    {percentualAnterior}% de {etapaAnterior.label}
                    {perda > 0 ? ` · −${perda}` : ""}
                  </span>
                ) : null}
                <span className="funnel-step-qtd">
                  {e.quantidade}
                  {e.valorLabel ? ` · ${e.valorLabel}` : ""}
                </span>
              </div>
              <div className="funnel-step-track">
                {/*
                  A cor da barra diz ONDE SE PERDE GENTE, e é a única coisa que este gráfico existe
                  pra mostrar. Seis barras do mesmo tom são seis números que precisam ser lidos um
                  a um; com a queda marcada em cor, o gargalo salta antes da leitura.
                  A primeira etapa não tem anterior, então não tem queda: fica neutra em vez de
                  fingir uma retenção de 100%.
                */}
                <div
                  className="funnel-step-fill"
                  data-retencao={i === 0 ? "inicio" : percentualAnterior >= 70 ? "boa" : percentualAnterior >= 40 ? "atencao" : "critica"}
                  style={{ width: `${largura}%` }}
                />
              </div>
            </Wrapper>
          </div>
        );
      })}
    </div>
  );
}

/**
 * GRÁFICO DE COLUNAS: uma barra por período, pra responder "como foi ao longo do tempo".
 *
 * Em HTML e CSS, não em SVG como o `LineChart` aqui do lado. A diferença que importa: o rótulo de
 * cada barra é TEXTO de verdade, então ele acompanha o tamanho de fonte do sistema, é lido por
 * leitor de tela e nunca sai desalinhado quando a fonte carrega depois. Num gráfico de linha o
 * caminho precisa de coordenadas e o SVG se paga; numa coluna, não.
 *
 * UMA SÉRIE SÓ, de propósito. Duas séries de barras lado a lado é a figura que parece analítica e
 * quase nunca é lida: pra comparar duas coisas no tempo, duas linhas funcionam melhor, e é pra
 * isso que o `LineChart` existe.
 */
export type ColunaDoGrafico = {
  chave: string;
  /** O que vai escrito embaixo da barra. Curto: "04/11", "13h", "nov". */
  rotulo: string;
  /** O balde por extenso, que aparece ao parar o mouse: "quarta-feira, 4 de novembro". */
  titulo: string;
  valor: number;
};

/**
 * O teto do eixo, arredondado pra um número que se lê.
 *
 * Sem isto o topo do gráfico é o maior valor, e o eixo vira "0 / 0.75 / 1.5 / 2.25 / 3" — que foi
 * exatamente o que apareceu na referência. Contagem de interação é número inteiro; meia interação
 * não existe, e escrever "2.25" no eixo é dizer que existe.
 */
export function tetoDoEixo(maior: number): number {
  if (maior <= 4) return Math.max(1, Math.ceil(maior));
  const magnitude = 10 ** Math.floor(Math.log10(maior));
  for (const passo of [1, 2, 2.5, 5, 10]) {
    const candidato = passo * magnitude;
    if (candidato >= maior) return Math.ceil(candidato);
  }
  return Math.ceil(10 * magnitude);
}

/** As marcas do eixo: sempre 0 e o teto, e as do meio só quando caem em número inteiro. */
export function marcasDoEixo(teto: number): number[] {
  const marcas = [0, teto];
  for (const fracao of [0.5, 0.25, 0.75]) {
    const valor = teto * fracao;
    if (Number.isInteger(valor) && !marcas.includes(valor) && marcas.length < 5) marcas.push(valor);
  }
  return marcas.sort((a, b) => a - b);
}

export function ColumnChart({
  colunas,
  altura = 200,
  cor = "var(--ss-azul, #657bff)",
}: {
  colunas: ColunaDoGrafico[];
  altura?: number;
  cor?: string;
}) {
  const { t: traduzir, localeNumero } = useIdioma();
  if (!colunas.length) return <p className="hint">{traduzir("Sem dados suficientes no período.")}</p>;

  const maior = Math.max(...colunas.map((c) => c.valor));
  const teto = tetoDoEixo(maior);
  const marcas = marcasDoEixo(teto);
  const total = colunas.reduce((soma, c) => soma + c.valor, 0);

  /* Com muitas barras os rótulos se encavalam. Em vez de girar o texto — que fica ilegível e muda
     a altura do gráfico —, escreve um a cada N e deixa o resto respirar. O balde de cada barra
     continua inteiro no título, ao parar o mouse. */
  const passoDoRotulo = Math.ceil(colunas.length / 12);

  return (
    <div className="gcol" style={{ "--gcol-altura": `${altura}px` } as React.CSSProperties}>
      <div className="gcol-eixo" aria-hidden="true">
        {[...marcas].reverse().map((m) => (
          <span key={m}>{m.toLocaleString(localeNumero)}</span>
        ))}
      </div>
      <div className="gcol-area">
        <div className="gcol-grades" aria-hidden="true">
          {[...marcas].reverse().map((m) => (
            <span key={m} />
          ))}
        </div>
        <ol
          className="gcol-barras"
          aria-label={traduzir("{total} no período", { total: total.toLocaleString(localeNumero) })}
        >
          {colunas.map((c, i) => (
            <li key={c.chave} className="gcol-barra">
              <span
                className="gcol-haste"
                style={{ height: `${(c.valor / teto) * 100}%`, background: cor }}
                title={`${c.titulo}: ${c.valor.toLocaleString(localeNumero)}`}
              >
                <span className="gcol-valor">{c.valor.toLocaleString(localeNumero)}</span>
              </span>
              <span className="gcol-rotulo">
                {i % passoDoRotulo === 0 || i === colunas.length - 1 ? c.rotulo : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card mb14">
      <div className="panel-h">
        <h4>{title}</h4>
        {action}
      </div>
      {/* A padding saiu do `style` inline pra uma classe: inline não dá pra ajustar por tela, e
          as telas de Inteligência comercial precisam de outro recuo depois que o contorno dos
          blocos saiu. Mesmos 17px em todo lugar que não ajustar. */}
      <div className="chart-card-corpo">{children}</div>
    </div>
  );
}
