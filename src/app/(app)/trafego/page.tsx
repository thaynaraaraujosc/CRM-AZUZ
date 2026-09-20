"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ORIGENS, type Campanha, type Origem } from "@/lib/data";
import { IconClose } from "@/components/icons";
import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import { useIntegracaoMeta } from "@/components/configuracoes/useIntegracaoMeta";
import { useGoogleAds } from "@/components/trafego/useGoogleAds";
import { acharNoCrm, normalizarNome, usePorCampanha } from "@/components/trafego/usePorCampanha";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { ChartCard, FunnelSteps } from "@/components/charts";
import {
  calcularInvestimentoTrafego,
  calcularLeadsTrafego,
  calcularRoasMedio,
  calcularValorVendido,
  formatarMoeda,
  parseSubCampanha,
  todosOsCards,
} from "@/lib/metrics";

type ColunaOrdenavel = "nome" | "investido" | "leads" | "vendas" | "cpl" | "roas";

/**
 * Visão completa da aquisição: do investimento até a receita. Campos que o
 * modelo de dados atual não liga de verdade (ex.: venda por campanha
 * específica, Google Ads sem integração própria) mostram "Dados não
 * conectados" em vez de número inventado. Inclusive a lista de campanhas
 * fica vazia até o Meta Ads ser conectado (antes mostrava mock inteiro).
 */
/**
 * O nome da plataforma de uma campanha.
 *
 * Antes era `plataforma === "M" ? "Meta Ads" : "Google Ads"`, o que rotulava como Google Ads
 * qualquer coisa que nao fosse Meta, inclusive o que o CRM nao sabe identificar. Agora o Google
 * tem integracao propria, entao "G" quer dizer Google Ads DE VERDADE; o que nao for nenhum dos
 * dois continua sendo "Outra", porque afirmar uma origem que o CRM nao sabe e o defeito original.
 */
function rotuloPlataforma(plataforma: string): string {
  if (plataforma === "M") return "Meta Ads";
  if (plataforma === "G") return "Google Ads";
  return "Outra";
}

/** O nome que a barra de filtro mostra pra letra guardada no estado. */
function rotuloDoFiltro(valor: string): string {
  if (valor === "M") return "Meta Ads";
  if (valor === "G") return "Google Ads";
  return "Todas";
}

export default function TrafegoPage() {
  const { funis } = useFunis();
  const { contatos } = useContatos();
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [plataformaFiltro, setPlataformaFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<ColunaOrdenavel>("investido");
  const [ordemDesc, setOrdemDesc] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [campanhaAberta, setCampanhaAberta] = useState<string | null>(null);

  const { integracao: adsIntegracao, desconectando: adsDesconectando, desconectar: desconectarAds } = useIntegracaoMeta("meta_ads");
  const [campanhasReais, setCampanhasReais] = useState<Campanha[] | null>(null);

  // Ajusta durante a renderização (não num efeito) quando o status muda pra "não conectado". Evita
  // setState síncrono dentro do corpo do efeito (regra `react-hooks/set-state-in-effect`).
  const [ultimoStatusAds, setUltimoStatusAds] = useState<string | null | undefined>(undefined);
  if (adsIntegracao?.status !== ultimoStatusAds) {
    setUltimoStatusAds(adsIntegracao?.status ?? null);
    if (adsIntegracao?.status !== "conectado") setCampanhasReais(null);
  }

  useEffect(() => {
    if (adsIntegracao?.status !== "conectado") return;
    fetch("/api/integracoes/meta/ads/campanhas")
      .then((r) => r.json())
      .then((dados) => (Array.isArray(dados) ? setCampanhasReais(dados) : setCampanhasReais(null)))
      .catch((erro) => console.error("Falha ao carregar campanhas do Meta Ads:", erro));
  }, [adsIntegracao?.status]);

  const { statusGoogle, campanhasGoogle, desconectando: googleDesconectando, desconectar: desconectarGoogle } = useGoogleAds();
  const { linhasDoCrm, leadsSemCampanha } = usePorCampanha();

  /*
   * Os dois canais na MESMA lista, e não em duas tabelas.
   *
   * Investimento, custo por lead, custo por venda e ROAS só querem dizer alguma coisa somando o
   * que a empresa gastou em toda parte. Separar em duas tabelas obrigaria quem olha a somar de
   * cabeça pra saber quanto custou um cliente, que é a única pergunta que essa tela existe pra
   * responder. A coluna "Plataforma" e o filtro é que separam, quando alguém quiser separar.
   *
   * Só entra campanha de verdade: sem nenhuma conexão a lista fica vazia (não mais um mock).
   */
  const campanhas = useMemo(() => {
    const daPlataforma = [...(campanhasReais ?? []), ...campanhasGoogle];

    /*
     * Campanha que o CRM conhece e a plataforma não devolveu.
     *
     * Sem isto a tabela inteira dependia de haver uma conexão de anúncio ativa: um cliente que usa
     * o link de rastreamento mas nunca conectou o Google Ads via a lista vazia, mesmo tendo dezenas
     * de leads com campanha identificada guardados no banco. O dado existia e ninguém mostrava.
     *
     * Entram sem investimento, porque investimento só a plataforma sabe. Leads, vendas e receita
     * são reais; o que falta fica em branco em vez de virar zero — zero afirma que não se gastou
     * nada, e não é isso que se sabe.
     */
    const jaNaPlataforma = new Set(
      daPlataforma.map((c) => `${c.plataforma === "M" ? "meta" : "google"}|${normalizarNome(c.nome)}`),
    );
    const soDoCrm: Campanha[] = linhasDoCrm
      .filter((l) => !jaNaPlataforma.has(`${l.plataforma}|${normalizarNome(l.campanhaNome)}`))
      .map((l) => ({
        plataforma: l.plataforma === "meta" ? "M" : "G",
        nome: l.campanhaNome,
        sub: `${l.leads} leads · R$ 0`,
        roas: "—",
        barra: 0,
        vendas: l.vendas,
        semPlataforma: true,
      }));

    return [...daPlataforma, ...soDoCrm];
  }, [campanhasReais, campanhasGoogle, linhasDoCrm]);

  // O filtro por Google Ads só existe quando o canal existe. Opção que devolve vazio SEMPRE faz
  // quem escolhe concluir que não houve investimento, e não que o canal não está ligado.
  const mostrarGoogle = statusGoogle.disponivel;

  const campanhasFiltradas = useMemo(
    () =>
      campanhas.filter((c) => {
        if (plataformaFiltro !== "Todas" && c.plataforma !== plataformaFiltro) return false;
        if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      }),
    [campanhas, plataformaFiltro, busca],
  );

  const linhasCampanha = useMemo(() => {
    const linhas = campanhasFiltradas.map((c) => {
      const { leads, investido } = parseSubCampanha(c.sub);
      const roasNum = Number(c.roas.replace(",", ".").replace("x", "")) || 0;
      const cpl = leads > 0 ? investido / leads : 0;
      /*
       * O mesmo par de colunas, contado duas vezes por fontes diferentes.
       *
       * A plataforma conta o que acontece dentro dela: clique, conversa iniciada, formulário
       * nativo. O CRM conta o que aconteceu depois: o lead virou contato, andou no funil, fechou.
       * Os dois números quase nunca batem, e a diferença é exatamente a informação que falta pra
       * decidir onde investir — plataforma dizendo 40 leads e CRM tendo 12 não é erro de conta, é
       * o custo real de aquisição aparecendo.
       *
       * Por isso nenhum dos dois substitui o outro na tabela: ficam lado a lado.
       */
      const crm = acharNoCrm(linhasDoCrm, c);
      // Linha que só o CRM conhece: a plataforma não foi consultada (ou não devolveu esta
      // campanha), então investimento, CPL e ROAS são DESCONHECIDOS, não zero. A diferença
      // importa: zero afirma que não se gastou nada, e afirmar isso sobre a campanha de alguém é
      // pior do que não dizer nada.
      const semPlataforma = (c as Campanha & { semPlataforma?: boolean }).semPlataforma === true;
      const receitaCrm = crm?.receita ?? 0;
      const leadsCrm = crm?.leads ?? 0;
      return {
        ...c,
        leads,
        investido,
        cpl,
        roasNum,
        vendas: c.vendas ?? 0,
        leadsCrm,
        vendasCrm: crm?.vendas ?? 0,
        receitaCrm,
        assistidas: crm?.vendasAssistidas ?? 0,
        // ROAS de verdade: receita que o FUNIL registrou dividida pelo que a PLATAFORMA cobrou.
        // Só a plataforma sabe o gasto e só o CRM sabe a venda; é o cruzamento que produz o número.
        roasCrm: investido > 0 ? receitaCrm / investido : 0,
        cplCrm: leadsCrm > 0 ? investido / leadsCrm : 0,
        semPlataforma,
      };
    });
    const chave = (l: (typeof linhas)[number]) =>
      ordenarPor === "nome" ? l.nome : ordenarPor === "roas" ? l.roasNum : l[ordenarPor];
    linhas.sort((a, b) => {
      const av = chave(a);
      const bv = chave(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return ordemDesc ? -cmp : cmp;
    });
    return linhas;
  }, [campanhasFiltradas, ordenarPor, ordemDesc, linhasDoCrm]);

  function alternarOrdenacao(col: ColunaOrdenavel) {
    if (ordenarPor === col) setOrdemDesc((v) => !v);
    else {
      setOrdenarPor(col);
      setOrdemDesc(true);
    }
  }

  function alternarSelecao(nome: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  const investido = calcularInvestimentoTrafego(campanhasFiltradas);
  const leads = calcularLeadsTrafego(campanhasFiltradas);
  const roas = calcularRoasMedio(campanhasFiltradas);
  const custoPorLead = leads.valor > 0 ? investido.valor / leads.valor : 0;
  const receita = calcularValorVendido(todosOsCards(funis));
  const vendas = todosOsCards(funis).filter((c) => c.statusFechamento === "ganho").length;
  const custoPorVenda = vendas > 0 ? investido.valor / vendas : 0;

  // Funil de tráfego usa as etapas de verdade do funil ativo (nome/quantidade de colunas variam
  // por workspace: não são mais 4 rótulos fixos de mock).
  const funilPrincipal = funis[0];
  const funilSteps = (funilPrincipal?.colunas ?? []).map((coluna, i, todas) => ({
    chave: coluna.id,
    label: coluna.titulo,
    quantidade: coluna.cards.length,
    valorLabel: i === todas.length - 1 ? receita.label : undefined,
  }));

  const origensComDados = ORIGENS.map((origem: Origem) => {
    const leadsOrigem = contatos.filter((c) => c.origem === origem).length;
    const vendasOrigem = todosOsCards(funis).filter((card) => card.origem === origem && card.statusFechamento === "ganho").length;
    /*
     * Investimento só existe pra origem que tem campanha ligada. "Google Ads" fica em `null`
     * (traço na tela) enquanto o canal não estiver conectado: zero ali diria "anunciou e não
     * gastou", que é afirmação, e não ausência de dado.
     */
    const plataformaDaOrigem = origem === "Meta Ads" ? "M" : origem === "Google Ads" ? "G" : null;
    const temConexao = plataformaDaOrigem === "M" || (plataformaDaOrigem === "G" && statusGoogle.status === "conectado");
    const investimentoOrigem =
      plataformaDaOrigem && temConexao
        ? campanhas
            .filter((c) => c.plataforma === plataformaDaOrigem)
            .reduce((s, c) => s + parseSubCampanha(c.sub).investido, 0)
        : null;
    return { origem, leadsOrigem, vendasOrigem, investimentoOrigem };
  });

  const campanhaDetalhe = campanhaAberta ? campanhas.find((c) => c.nome === campanhaAberta) : null;

  const filtros: FiltroDef[] = [
    {
      chave: "plataforma",
      label: "Plataforma",
      valor: plataformaFiltro,
      opcoes: [
        { valor: "Todas", label: "Todas" },
        { valor: "M", label: "Meta Ads" },
        ...(mostrarGoogle ? [{ valor: "G", label: "Google Ads" }] : []),
      ],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Tráfego</h2>
          </div>
          <p className="sub">Da aquisição de leads até a receita atribuída às campanhas</p>
        </div>
        <div className="top-actions">
          {adsIntegracao?.status === "conectado" ? (
            <>
              <span className="hint">
                Meta Ads conectado: {(adsIntegracao.metadados?.adAccountNome as string | undefined) ?? "conta"}
              </span>
              <button type="button" className="btn ghost" onClick={() => void desconectarAds()} disabled={adsDesconectando}>
                {adsDesconectando ? "Desconectando…" : "Desconectar Meta Ads"}
              </button>
            </>
          ) : (
            <a className="btn ghost" href="/api/integracoes/meta/conectar?provedor=meta_ads">
              Conectar Meta Ads
            </a>
          )}
          {mostrarGoogle ? (
            statusGoogle.status === "conectado" ? (
              <>
                <span className="hint">Google Ads conectado: conta {statusGoogle.contaId ?? "—"}</span>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void desconectarGoogle()}
                  disabled={googleDesconectando}
                >
                  {googleDesconectando ? "Desconectando…" : "Desconectar Google Ads"}
                </button>
              </>
            ) : (
              <a className="btn ghost" href="/api/integracoes/google-ads/conectar">
                Conectar Google Ads
              </a>
            )
          ) : null}
          <Link className="btn primary" href="/relatorios?tipo=trafego">
            Gerar relatório de tráfego
          </Link>
        </div>
      </div>

      <div className="content trafego-view">
        {/*
          Conexão quebrada precisa DIZER que quebrou. Quando o cliente remove o acesso do CRM na
          conta Google dele, não há conserto automático: sem este aviso a tela mostraria campanha
          nenhuma, e a leitura natural seria "não investi nada".
        */}
        {mostrarGoogle && statusGoogle.status === "erro" ? (
          <div className="card mb14">
            <div className="dados-nao-conectados trafego-vazio">
              <strong>A conexão com o Google Ads parou de funcionar.</strong>
              <span>{statusGoogle.erroMensagem ?? "Conecte de novo para voltar a ler as campanhas."}</span>
            </div>
          </div>
        ) : null}
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          principalLabel="Plataforma"
          principalValor={rotuloDoFiltro(plataformaFiltro)}
          principalOpcoes={mostrarGoogle ? ["Todas", "Meta Ads", "Google Ads"] : ["Todas", "Meta Ads"]}
          onPrincipalChange={(v) => setPlataformaFiltro(v === "Meta Ads" ? "M" : v === "Google Ads" ? "G" : "Todas")}
          filtros={filtros}
          onFiltroChange={(chave, valor) => {
            if (chave === "plataforma") setPlataformaFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setPlataformaFiltro("Todas");
          }}
          onExportar={() => window.print()}
          viewKey="trafego"
        />

        {/*
          Sem campanha conectada, mostrar SO o aviso.
          Antes o aviso aparecia e os seis indicadores vinham logo abaixo, todos zerados. Dizia a
          mesma coisa duas vezes, e a segunda vez dizia errado: zero parece numero apurado, e quem
          olha conclui que investiu e nao teve retorno, em vez de que nada esta conectado.
        */}
        {campanhas.length === 0 ? (
          <div className="card mb14">
            <div className="dados-nao-conectados trafego-vazio">
              <strong>
                {mostrarGoogle
                  ? "Conecte o Meta Ads ou o Google Ads para ver esta tela com dados."
                  : "Conecte o Meta Ads para ver esta tela com dados."}
              </strong>
              <span>
                Investimento, custo por lead, custo por venda e ROAS saem das suas campanhas. Sem a
                conexão não há o que calcular, então os números ficam de fora em vez de aparecerem
                zerados.
              </span>
            </div>
          </div>
        ) : (
        <div className="grid kpi6">
          <KpiCard label="Investido" value={investido.label} formula={investido.formula} />
          <KpiCard label="Leads" value={leads.label} formula={leads.formula} href="/funil" />
          <KpiCard
            label="Custo / lead"
            value={formatarMoeda(custoPorLead)}
            formula="Investido em tráfego ÷ leads gerados, nas campanhas filtradas"
          />
          <KpiCard label="Vendas" value={String(vendas)} href="/performance-vendas" />
          <KpiCard label="Custo / venda" value={formatarMoeda(custoPorVenda)} />
          <KpiCard label="ROAS" value={roas.label} formula={roas.formula} />
        </div>
        )}

        <ChartCard title="Funil de tráfego">
          {funilSteps.length === 0 ? (
            <p className="hint trafego-aviso">Crie um funil com etapas pra ver essa visão aqui.</p>
          ) : (
            <FunnelSteps etapas={funilSteps} />
          )}
        </ChartCard>

        <div className="card mb14">
          <div className="panel-h">
            <h4>Desempenho por campanha</h4>
            <div className="filters-row" style={{ margin: 0 }}>
              <input
                className="input"
                placeholder="Pesquisar campanha…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: 180 }}
              />
              {selecionadas.size > 1 ? (
                <span className="hint">{selecionadas.size} selecionadas pra comparar</span>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Plataforma</th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("nome")}>
                    Campanha {ordenarPor === "nome" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("investido")}>
                    Investimento {ordenarPor === "investido" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("leads")}>
                    Leads {ordenarPor === "leads" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("vendas")}>
                    Vendas {ordenarPor === "vendas" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("cpl")}>
                    CPL {ordenarPor === "cpl" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("roas")}>
                    ROAS {ordenarPor === "roas" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th className="trafego-col-crm">Leads no CRM</th>
                  <th className="trafego-col-crm">Vendas no CRM</th>
                  <th className="trafego-col-crm">ROAS real</th>
                </tr>
              </thead>
              <tbody>
                {linhasCampanha.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
                      <p className="hint trafego-aviso">Nenhuma campanha com esses filtros.</p>
                    </td>
                  </tr>
                ) : null}
                {linhasCampanha.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.has(c.nome)}
                        onChange={() => alternarSelecao(c.nome)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </td>
                    <td>{rotuloPlataforma(c.plataforma)}</td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() => setCampanhaAberta((atual) => (atual === c.nome ? null : c.nome))}
                      >
                        {c.nome}
                      </button>
                      {c.pausada ? <span className="tag" style={{ marginLeft: 8 }}>pausada</span> : null}
                    </td>
                    <td>{c.semPlataforma ? "—" : formatarMoeda(c.investido)}</td>
                    <td>{c.semPlataforma ? "—" : c.leads}</td>
                    <td>{c.semPlataforma ? "—" : c.vendas}</td>
                    <td>{c.semPlataforma ? "—" : formatarMoeda(c.cpl)}</td>
                    <td>{c.semPlataforma ? "—" : c.roas}</td>
                    <td className="trafego-col-crm">
                      {c.leadsCrm}
                      {c.leadsCrm > 0 && !c.semPlataforma ? (
                        <span className="trafego-cpl-crm">{formatarMoeda(c.cplCrm)}/lead</span>
                      ) : null}
                    </td>
                    <td className="trafego-col-crm">
                      {c.vendasCrm}
                      {c.assistidas > 0 ? (
                        <span
                          className="trafego-cpl-crm"
                          title="Vendas em que esta campanha participou sem ter trazido o lead"
                        >
                          +{c.assistidas} assistida{c.assistidas === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </td>
                    <td className="trafego-col-crm">
                      {c.receitaCrm > 0 ? (
                        <>
                          {/* ROAS só existe com os dois lados: receita daqui e gasto de lá. Sem o
                              gasto, mostra só a receita — que é verdade — e omite a divisão. */}
                          {c.semPlataforma ? "—" : `${c.roasCrm.toFixed(2).replace(".", ",")}x`}
                          <span className="trafego-cpl-crm">{formatarMoeda(c.receitaCrm)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint trafego-aviso">
            As colunas à esquerda são o que a <strong>plataforma de anúncio</strong> informa: ela só
            enxerga o que acontece dentro dela. As três da direita são o que o <strong>CRM</strong>{" "}
            registrou de verdade — lead que virou contato e negócio marcado como ganho no funil. O
            ROAS real cruza os dois: receita do seu funil dividida pelo que a plataforma cobrou.{" "}
            <strong>Assistida</strong> é venda em que a campanha participou sem ter trazido o lead —
            a pessoa viu o anúncio, não comprou, e voltou por outro caminho. Desligar uma campanha
            com muitas assistidas costuma derrubar junto a que estava fechando.
            {leadsSemCampanha > 0 ? (
              <>
                {" "}
                {leadsSemCampanha}{" "}
                {leadsSemCampanha === 1 ? "lead veio de anúncio mas sem" : "leads vieram de anúncio mas sem"}{" "}
                identificação de campanha, então não aparecem em nenhuma linha.
              </>
            ) : null}
          </p>
        </div>

        {campanhaDetalhe ? (
          <div className="card mb14">
            <div className="panel-h">
              <h4>{campanhaDetalhe.nome}</h4>
              <button type="button" className="link" onClick={() => setCampanhaAberta(null)}>
                Fechar <IconClose width={11} height={11} />
              </button>
            </div>
            <div className="trafego-detalhe-corpo">
              <div className="stat-row">
                <span className="sl">Plataforma</span>
                <span className="sv">{rotuloPlataforma(campanhaDetalhe.plataforma)}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Investimento</span>
                <span className="sv">{formatarMoeda(parseSubCampanha(campanhaDetalhe.sub).investido)}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Leads</span>
                <span className="sv">{parseSubCampanha(campanhaDetalhe.sub).leads}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Vendas</span>
                <span className="sv">{campanhaDetalhe.vendas ?? 0}</span>
              </div>
              <div className="stat-row">
                <span className="sl">ROAS</span>
                <span className="sv">{campanhaDetalhe.roas}</span>
              </div>
              <div className="stat-row">
                <span className="sl">Status</span>
                <span className="sv">{campanhaDetalhe.pausada ? "Pausada" : "Ativa"}</span>
              </div>
              <Link
                href={`/contatos`}
                className="link"
                style={{ display: "inline-block", marginTop: 8 }}
              >
                Ver leads dessa plataforma →
              </Link>
              <p className="hint" style={{ marginTop: 10 }}>
                Evolução no período, anúncios individuais e motivos de perda por campanha entram aqui
                quando o back-end ligar cada negociação à campanha que a originou.
              </p>
            </div>
          </div>
        ) : null}

        <ChartCard title="Origens">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Leads</th>
                  <th>Vendas</th>
                  <th>Investimento</th>
                </tr>
              </thead>
              <tbody>
                {origensComDados.map((o) => (
                  <tr key={o.origem}>
                    <td>{o.origem}</td>
                    <td>{o.leadsOrigem}</td>
                    <td>{o.vendasOrigem}</td>
                    {/*
                      Traco, e nao "Dados nao conectados" escrito em cada linha.
                      Investimento so existe pra origem que veio de campanha paga; nas outras (site,
                      indicacao, WhatsApp) nao ha o que investir, entao nao e falta de conexao, e
                      ausencia legitima. Repetir uma frase de erro linha a linha fazia a tabela
                      parecer quebrada e empurrava as colunas de numero pra fora do alinhamento.
                    */}
                    <td className="trafego-sem-valor">
                      {o.investimentoOrigem !== null ? formatarMoeda(o.investimentoOrigem) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </>
  );
}
