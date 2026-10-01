"use client";

import { useState } from "react";

import { useConversas } from "@/lib/conversas-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { BarList, ChartCard } from "@/components/charts";
import { calcularLeadsAguardando } from "@/lib/metrics";

const GRUPOS = ["Atendimento", "Interações"] as const;
type Grupo = (typeof GRUPOS)[number];

/**
 * Atividades reduzida a dois grupos (controle segmentado simples), com
 * filtros dentro da FilterBar em vez de espalhados em várias linhas. Cada
 * indicador é clicável e abre os registros correspondentes. Tempo de
 * primeira resposta por responsável e ligações ainda não têm fonte real no
 * CRM (não existe telefonia integrada nem tracking de responsável por
 * mensagem): aparecem como "Dados não conectados" em vez de número
 * inventado.
 */
export default function AtividadesVendasPage() {
  const { funis } = useFunis();
  const { membros: equipe } = useEquipe();
  const { conversas } = useConversas();
  const { mensagensExtraPorContato } = useMensagensExtra();
  const [grupo, setGrupo] = useState<Grupo>("Atendimento");
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");

  const conversasFiltradas = conversas.filter(
    (c) => responsavelFiltro === "Todos" || c.atendenteSelecionado === responsavelFiltro,
  );

  const leadsRecebidos = conversasFiltradas.length;
  const leadsAtendidos = conversasFiltradas.filter((c) => c.status !== "Não respondido").length;
  const leadsSemResposta = calcularLeadsAguardando(conversasFiltradas);

  function mensagensDe(nome: string) {
    return mensagensExtraPorContato[nome] ?? [];
  }
  const mensagensEnviadas = conversasFiltradas.reduce((s, c) => s + mensagensDe(c.nome).filter((m) => m.tipo === "out").length, 0);
  const mensagensRecebidas = conversasFiltradas.reduce((s, c) => s + mensagensDe(c.nome).filter((m) => m.tipo === "in").length, 0);
  const contatosSemInteracao = conversas.filter((c) => mensagensDe(c.nome).length === 0);

  const filtros: FiltroDef[] = [
    {
      chave: "responsavel",
      label: "Responsável",
      valor: responsavelFiltro,
      opcoes: [{ valor: "Todos", label: "Todos" }, ...equipe.map((m) => ({ valor: m.nome, label: m.nome }))],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Atividades</h2>
          </div>
          <p className="sub">Como a equipe está se comportando. Atendimento e interações</p>
        </div>
      </div>

      <div className="content atividades-vendas">
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          principalLabel="Funil"
          principalValor={funilFiltro}
          principalOpcoes={["Todos", ...funis.map((f) => f.nome)]}
          onPrincipalChange={setFuncilFiltro}
          filtros={filtros}
          onFiltroChange={(chave, valor) => {
            if (chave === "responsavel") setResponsavelFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setFuncilFiltro("Todos");
            setResponsavelFiltro("Todos");
          }}
          viewKey="atividades"
        />

        <div className="filters-row mb14">
          {GRUPOS.map((g) => (
            <button
              type="button"
              key={g}
              className={`fchip${grupo === g ? " active" : ""}`}
              aria-pressed={grupo === g}
              onClick={() => setGrupo(g)}
            >
              {g}
            </button>
          ))}
        </div>

        {grupo === "Atendimento" ? (
          <>
            <div className="grid kpi4">
              <KpiCard label="Leads recebidos" value={String(leadsRecebidos)} href="/conversas" tom="acento" />
              <KpiCard label="Leads atendidos" value={String(leadsAtendidos)} href="/conversas" tom="acento" />
              <KpiCard
                label="Leads sem resposta"
                value={leadsSemResposta.label}
                formula={leadsSemResposta.formula}
                href="/conversas"
              />
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Tempo de primeira resposta por responsável</h4>
              </div>
              <div className="dados-nao-conectados" style={{ margin: 17 }}>
                Dados não conectados: o CRM ainda não rastreia qual responsável atendeu cada
                mensagem, então não dá pra medir tempo de resposta por pessoa ainda.
              </div>
            </div>
          </>
        ) : null}

        {grupo === "Interações" ? (
          <>
            <div className="grid kpi4">
              <KpiCard label="Mensagens enviadas" value={String(mensagensEnviadas)} href="/conversas" />
              <KpiCard label="Mensagens recebidas" value={String(mensagensRecebidas)} href="/conversas" />
              <KpiCard
                label="Contatos sem interação"
                value={String(contatosSemInteracao.length)}
                href="/contatos"
              />
            </div>

            <ChartCard title="Interações por responsável (conversas atribuídas)">
              {equipe.every((m) => conversas.filter((c) => c.atendenteSelecionado === m.nome).length === 0) ? (
                <p className="hint" style={{ padding: 17 }}>Nenhuma conversa atribuída a um responsável ainda.</p>
              ) : (
                <BarList
                  items={equipe
                    .map((m) => ({
                      chave: m.nome,
                      label: m.nome,
                      quantidade: conversas.filter((c) => c.atendenteSelecionado === m.nome).length,
                    }))
                    .filter((r) => r.quantidade > 0)}
                />
              )}
            </ChartCard>

            <div className="grid split2">
              <div className="card">
                <div className="panel-h">
                  <h4>Ligações</h4>
                </div>
                <div className="dados-nao-conectados" style={{ margin: 17 }}>
                  Dados não conectados: o CRM ainda não tem telefonia integrada.
                </div>
              </div>
              <div className="card">
                <div className="panel-h">
                  <h4>Reuniões e e-mails</h4>
                </div>
                <div className="dados-nao-conectados" style={{ margin: 17 }}>
                  Dados não conectados: conecte agenda/e-mail pra ver reuniões e e-mails aqui.
                </div>
              </div>
            </div>
            <div className="card">
              <div className="panel-h">
                <h4>Documentos enviados</h4>
              </div>
              <div className="dados-nao-conectados" style={{ margin: 17 }}>
                Dados não conectados: vincule documentos a conversas pra ver esse total aqui.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
