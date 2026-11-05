"use client";

import { useEffect, useState } from "react";

import { Topbar } from "@/components/ui";

type Overview = {
  totalWorkspaces: number;
  totalMembros: number;
  membrosAtivos: number;
  totalAssinaturas: number;
  mrr: number;
  pagantes: number;
  emCortesia: number;
  liberadasSemCobranca: number;
  porStatus: Record<string, number>;
  crescimento: { mes: string; total: number }[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NOME_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MES_POR_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * UM NÚMERO DO PAINEL.
 *
 * Próprio, e não o `KpiCard` do resto do CRM, por um motivo de medida: dentro de `.admin-view` o
 * cartão compartilhado perde o respiro lateral (`padding-inline: 0`, que existe pra as tabelas do
 * admin irem até a borda) e o texto encosta na beirada. Era o que estava na tela: quatro caixas de
 * 126px de altura com o rótulo colado na esquerda e um vazio embaixo.
 *
 * O `sub` é obrigatório, e isso também é medida: num grid de quatro, o cartão sem segunda linha
 * fica esticado à altura dos outros e vira um retângulo oco. Se não há o que dizer embaixo do
 * número, o cartão não precisa existir.
 */
function Indicador({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className="painel-kpi">
      <p className="painel-kpi-rotulo">{rotulo}</p>
      <p className="painel-kpi-valor">{valor}</p>
      <p className="painel-kpi-sub">{sub}</p>
    </div>
  );
}

/**
 * EMPRESAS NOVAS POR MÊS.
 *
 * Uma série só, então sem legenda: o título já diz o que está desenhado. O número aparece na
 * cabeça da barra apenas onde houve empresa nova — imprimir "0" em cima de cada mês vazio é ruído
 * repetido, e o eixo da esquerda já responde por eles. Mês sem nada não desenha barra nenhuma:
 * o espaço vazio é a informação.
 *
 * A cor é `--blue`, que o produto já troca sozinho entre os temas (marinho no claro, dourado no
 * escuro). Os dois passam no teste de contraste contra a superfície do seu tema. As outras duas
 * provas do validador — faixa de luminosidade e piso de croma — são pra paleta CATEGÓRICA, onde
 * várias cores precisam se distinguir entre si; com uma série só não há par a distinguir.
 */
function GraficoCrescimento({ crescimento }: { crescimento: Overview["crescimento"] }) {
  const maior = Math.max(...crescimento.map((c) => c.total));
  // O topo do eixo é sempre >= 1: com tudo zerado, dividir por zero deixaria a altura em NaN.
  const topo = Math.max(1, maior);
  // Três marcas no eixo quando dá (0, meio, topo); só 0 e topo quando o topo é 1 e não há meio.
  const marcas = topo === 1 ? [1, 0] : [topo, Math.round(topo / 2), 0];
  const total = crescimento.reduce((s, c) => s + c.total, 0);

  return (
    <section className="card painel-grafico">
      {/* `div`, não `p`: `<h4>` dentro de `<p>` é aninhamento inválido, e o navegador fecha o
          parágrafo sozinho antes do título. O HTML que o servidor manda e o que o navegador monta
          deixam de bater, o React acusa erro de hidratação e o painel quebra na abertura. */}
      <div className="panel-h painel-grafico-topo">
        <h4>Empresas novas por mês</h4>
        <span className="painel-grafico-nota">
          {total === 1 ? "1 nos últimos 6 meses" : `${total} nos últimos 6 meses`}
        </span>
      </div>

      <div className="painel-plot">
        <div className="painel-eixo" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="painel-area">
          {/* Grade: traço de 1px, contínuo, um passo acima da superfície. Pontilhado lê como
              "meta" ou "projeção" quando é só grade. */}
          <div className="painel-grade" aria-hidden="true">
            {marcas.map((m) => (
              <i key={m} />
            ))}
          </div>
          <ol className="painel-colunas">
            {crescimento.map((c) => {
              const [ano, mes] = c.mes.split("-");
              const numeroDoMes = Number(mes) - 1;
              const altura = (c.total / topo) * 100;
              return (
                <li
                  key={c.mes}
                  className="painel-coluna"
                  aria-label={`${MES_POR_EXTENSO[numeroDoMes]} de ${ano}: ${
                    c.total === 1 ? "1 empresa nova" : `${c.total} empresas novas`
                  }`}
                >
                  <div className="painel-coluna-trilho">
                    {c.total > 0 ? (
                      <>
                        <span className="painel-coluna-valor">{c.total}</span>
                        <div className="painel-barra" style={{ height: `${altura}%` }} />
                      </>
                    ) : null}
                  </div>
                  <span className="painel-coluna-mes">
                    {NOME_MES[numeroDoMes]}/{ano.slice(2)}
                  </span>
                  <span className="painel-coluna-dica" role="presentation">
                    {MES_POR_EXTENSO[numeroDoMes]} · {c.total === 1 ? "1 empresa" : `${c.total} empresas`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}


/**
 * SITUAÇÃO DAS CONTAS: uma barra fina e a lista ao lado.
 *
 * O painel já calculava isto e não mostrava em lugar nenhum — `porStatus` saía da API e morria.
 * Mostrar aqui também resolve um problema de desenho: sem ela, o gráfico de seis meses ocupava a
 * largura inteira da tela e três barras magras ficavam perdidas num campo branco de dois metros.
 *
 * A barra é a FINA, sem texto: quem dá os números é a lista logo abaixo, e imprimi-los duas vezes
 * não acrescenta nada. Cada linha tem o nome ao lado da bolinha, então a identidade nunca depende
 * só da cor. Verde/amarelo/vermelho aqui são cor de ESTADO, não de série — é o que elas
 * significam mesmo.
 */
const SITUACOES: { chave: string; label: string; cor: string }[] = [
  { chave: "ativa", label: "Ativas", cor: "var(--success)" },
  { chave: "pendente", label: "Pendentes", cor: "var(--warning)" },
  { chave: "atrasada", label: "Atrasadas", cor: "var(--danger)" },
  { chave: "cancelada", label: "Canceladas", cor: "var(--text-faint)" },
];

function SituacaoDasContas({ dados }: { dados: Overview }) {
  const comAssinatura = Object.values(dados.porStatus).reduce((s, n) => s + n, 0);
  const semAssinatura = Math.max(0, dados.totalWorkspaces - comAssinatura);

  const fatias = [
    ...SITUACOES.map((s) => ({ ...s, total: dados.porStatus[s.chave] ?? 0 })),
    ...(semAssinatura > 0
      ? [{ chave: "sem", label: "Sem assinatura", cor: "var(--line-strong)", total: semAssinatura }]
      : []),
  ].filter((f) => f.total > 0);

  const total = fatias.reduce((s, f) => s + f.total, 0);

  return (
    <section className="card painel-situacao">
      <div className="panel-h painel-grafico-topo">
        <h4>Situação das contas</h4>
        <span className="painel-grafico-nota">{total === 1 ? "1 empresa" : `${total} empresas`}</span>
      </div>

      {total === 0 ? (
        <p className="hint">Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <>
          {/* Barra fina, pontas redondas, sem linha de base: é uma figura, não um gráfico com
              eixo. Fatia zerada não desenha nada. O respiro de 2px entre as partes é a cor da
              superfície passando no meio — nunca um contorno em volta de cada pedaço. */}
          <div className="painel-fatias" role="presentation">
            {fatias.map((f) => (
              <span key={f.chave} style={{ flexGrow: f.total, background: f.cor }} />
            ))}
          </div>
          <ul className="painel-situacao-lista">
            {fatias.map((f) => (
              <li key={f.chave}>
                <span className="painel-ponto" style={{ background: f.cor }} aria-hidden="true" />
                {f.label}
                <strong>{f.total}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Dashboard do super-admin: visão geral da plataforma inteira — quantas empresas e pessoas
 *  existem, quanto entra por mês de verdade, quantas usam de graça, e o crescimento recente. */
export default function AdminDashboardPage() {
  const [dados, setDados] = useState<Overview | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setDados)
      .catch(() => setErro("Falha ao carregar os dados."));
  }, []);

  const novasNoMes = dados?.crescimento[dados.crescimento.length - 1]?.total ?? 0;

  return (
    <div className="view">
      <Topbar title="Painel" sub="Todas as empresas da plataforma." />

      {erro ? <p className="admin-secao" style={{ color: "var(--danger)" }}>{erro}</p> : null}

      {dados ? (
        <>
          <div className="painel-kpis">
            <Indicador
              rotulo="Empresas"
              valor={String(dados.totalWorkspaces)}
              sub={novasNoMes === 1 ? "1 nova este mês" : `${novasNoMes} novas este mês`}
            />
            <Indicador
              rotulo="Pessoas"
              valor={String(dados.totalMembros)}
              sub={`${dados.membrosAtivos} com acesso`}
            />
            {/*
              O MRR CONTA SÓ QUEM PAGA DE VERDADE.

              Ele dizia "4 assinaturas ativas" e uma receita que nunca entrou: conta de cortesia e
              conta de teste nascem com status "ativa" de propósito, porque é isso que libera o
              produto pra elas. Agora o número é o de quem tem cobrança na Asaas, e as liberadas
              aparecem no cartão ao lado — porque "quantas contas usam de graça" também é
              informação, só não é dinheiro.
            */}
            <Indicador
              rotulo="Receita por mês"
              valor={formatarMoeda(dados.mrr)}
              sub={`${dados.pagantes} ${dados.pagantes === 1 ? "conta pagando" : "contas pagando"}`}
            />
            <Indicador
              rotulo="Usando de graça"
              valor={String(dados.liberadasSemCobranca)}
              sub={
                dados.emCortesia > 0
                  ? `${dados.emCortesia} com prazo de cortesia`
                  : "nenhuma com prazo marcado"
              }
            />
          </div>

          <div className="painel-linha">
            <GraficoCrescimento crescimento={dados.crescimento} />
            <SituacaoDasContas dados={dados} />
          </div>
        </>
      ) : !erro ? (
        <p className="admin-secao" style={{ color: "var(--text-muted)" }}>Carregando…</p>
      ) : null}
    </div>
  );
}
