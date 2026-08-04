"use client";

import { useState } from "react";
import Link from "next/link";

import { conversas, ligacoesPorResponsavel, tempoPrimeiroContatoPorResponsavel } from "@/lib/data";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { useTarefas } from "@/lib/tarefas-context";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { BarList, ChartCard } from "@/components/charts";
import {
  calcularLeadsAguardando,
  calcularOportunidadesContatadas,
  calcularTempoMedioPrimeiroContato,
} from "@/lib/metrics";

const GRUPOS = ["Atendimento", "Tarefas", "Interações"] as const;
type Grupo = (typeof GRUPOS)[number];

/** Meta de tempo de primeira resposta — usada só pra classificar dentro/fora, sem mudar o dado bruto. */
const META_MINUTOS = 60;

/**
 * Atividades reduzida a três grupos (controle segmentado simples), com
 * filtros dentro da FilterBar em vez de espalhados em várias linhas. Cada
 * indicador é clicável e abre os registros correspondentes.
 */
export default function AtividadesVendasPage() {
  const { funis } = useFunis();
  const { membros: equipe } = useEquipe();
  const { colunas: tarefas } = useTarefas();
  const [grupo, setGrupo] = useState<Grupo>("Atendimento");
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");

  const dadosResponsavel = tempoPrimeiroContatoPorResponsavel.filter(
    (r) => responsavelFiltro === "Todos" || r.nome === responsavelFiltro,
  );
  const conversasFiltradas = conversas.filter(
    (c) => responsavelFiltro === "Todos" || c.atendenteSelecionado === responsavelFiltro,
  );

  const contatadas = calcularOportunidadesContatadas(dadosResponsavel);
  const tempoMedio = calcularTempoMedioPrimeiroContato(dadosResponsavel);
  const menorTempo = dadosResponsavel.reduce<typeof dadosResponsavel[number] | null>(
    (menor, r) => (!menor || r.minutos < menor.minutos ? r : menor),
    null,
  );
  const maiorTempo = dadosResponsavel.reduce<typeof dadosResponsavel[number] | null>(
    (maior, r) => (!maior || r.minutos > maior.minutos ? r : maior),
    null,
  );
  const dentroMeta = dadosResponsavel.filter((r) => r.minutos <= META_MINUTOS).length;
  const foraMeta = dadosResponsavel.length - dentroMeta;

  const leadsRecebidos = conversasFiltradas.length;
  const leadsAtendidos = conversasFiltradas.filter((c) => c.status !== "Não respondido").length;
  const leadsSemResposta = calcularLeadsAguardando(conversasFiltradas);

  const todasAsTarefas = tarefas.flatMap((c) => c.cards);
  const tarefasFiltradas = todasAsTarefas.filter(
    (t) => responsavelFiltro === "Todos" || t.responsavel.nome === responsavelFiltro,
  );
  const proximosVencimentos = tarefasFiltradas.filter((t) => !t.atrasada && !t.concluida).slice(0, 5);

  const ligacoesFiltradas = ligacoesPorResponsavel.filter(
    (r) => responsavelFiltro === "Todos" || r.nome === responsavelFiltro,
  );
  const mensagensEnviadas = conversasFiltradas.reduce(
    (s, c) => s + c.mensagens.filter((m) => m.tipo === "out").length,
    0,
  );
  const mensagensRecebidas = conversasFiltradas.reduce(
    (s, c) => s + c.mensagens.filter((m) => m.tipo === "in").length,
    0,
  );
  const contatosSemInteracao = conversas.filter((c) => c.mensagens.length === 0);
  const nomesComTarefa = new Set(todasAsTarefas.map((t) => t.contato));
  const negociacoesSemProximaAtividade = funis
    .flatMap((f) => f.colunas.filter((c) => !c.titulo.startsWith("Fechado")).flatMap((c) => c.cards))
    .filter((card) => !nomesComTarefa.has(card.nome));

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
          <p className="sub">Como a equipe está se comportando — atendimento, tarefas e interações</p>
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
              <KpiCard label="Leads recebidos" value={String(leadsRecebidos)} href="/conversas" />
              <KpiCard label="Leads atendidos" value={String(leadsAtendidos)} href="/conversas" />
              <KpiCard
                label="Leads sem resposta"
                value={leadsSemResposta.label}
                formula={leadsSemResposta.formula}
                href="/conversas"
              />
              <KpiCard label="Oportunidades contatadas" value={contatadas.label} formula={contatadas.formula} />
              <KpiCard label="Tempo médio de primeira resposta" value={tempoMedio.label} formula={tempoMedio.formula} />
              <KpiCard label="Menor tempo" value={menorTempo?.tempoMedio ?? "—"} sub={menorTempo?.nome} />
              <KpiCard label="Maior tempo" value={maiorTempo?.tempoMedio ?? "—"} sub={maiorTempo?.nome} />
              <KpiCard
                label="Dentro / fora da meta"
                value={`${dentroMeta} / ${foraMeta}`}
                sub={`Meta: até ${META_MINUTOS}min`}
              />
            </div>

            <ChartCard title="Tempo de primeira resposta por responsável">
              <BarList
                items={dadosResponsavel.map((r) => ({
                  chave: r.nome,
                  label: r.nome,
                  meta: `${r.oportunidades} contatadas · ${r.tempoMedio}`,
                  quantidade: r.minutos,
                }))}
              />
            </ChartCard>
          </>
        ) : null}

        {grupo === "Tarefas" ? (
          <>
            <div className="grid kpi4">
              <KpiCard
                label="Criadas"
                value={String(tarefasFiltradas.length)}
                href="/tarefas"
              />
              <KpiCard
                label="Concluídas"
                value={String(tarefasFiltradas.filter((t) => t.concluida).length)}
                href="/tarefas"
              />
              <KpiCard
                label="Pendentes"
                value={String(tarefasFiltradas.filter((t) => !t.concluida && !t.atrasada).length)}
                href="/tarefas"
              />
              <KpiCard
                label="Atrasadas"
                value={String(tarefasFiltradas.filter((t) => t.atrasada).length)}
                href="/tarefas"
              />
            </div>

            <ChartCard title="Tarefas por responsável">
              <BarList
                items={equipe
                  .map((m) => ({
                    chave: m.nome,
                    label: m.nome,
                    quantidade: todasAsTarefas.filter((t) => t.responsavel.nome === m.nome).length,
                  }))
                  .filter((r) => r.quantidade > 0)}
              />
            </ChartCard>

            <div className="card">
              <div className="panel-h">
                <h4>Próximos vencimentos</h4>
              </div>
              {proximosVencimentos.length === 0 ? (
                <p className="hint" style={{ padding: 17 }}>Nenhuma tarefa pendente no momento.</p>
              ) : (
                proximosVencimentos.map((t) => (
                  <Link className="stat-row stat-row-link" href="/tarefas" key={t.id}>
                    <span className="sl">{t.titulo} · {t.contato}</span>
                    <span className="sv">{t.data}</span>
                  </Link>
                ))
              )}
            </div>
          </>
        ) : null}

        {grupo === "Interações" ? (
          <>
            <div className="grid kpi4">
              <KpiCard label="Mensagens enviadas" value={String(mensagensEnviadas)} href="/conversas" />
              <KpiCard label="Mensagens recebidas" value={String(mensagensRecebidas)} href="/conversas" />
              <KpiCard
                label="Ligações"
                value={String(ligacoesFiltradas.reduce((s, r) => s + r.quantidade, 0))}
              />
              <KpiCard
                label="Contatos sem interação"
                value={String(contatosSemInteracao.length)}
                href="/contatos"
              />
            </div>

            <ChartCard title="Interações por responsável (mensagens · conversas)">
              <BarList
                items={equipe
                  .map((m) => ({
                    chave: m.nome,
                    label: m.nome,
                    quantidade: conversas.filter((c) => c.atendenteSelecionado === m.nome).length,
                  }))
                  .filter((r) => r.quantidade > 0)}
              />
            </ChartCard>

            <div className="card">
              <div className="panel-h">
                <h4>Negociações sem próxima atividade</h4>
              </div>
              {negociacoesSemProximaAtividade.length === 0 ? (
                <p className="hint" style={{ padding: 17 }}>Todas as negociações abertas têm uma tarefa vinculada.</p>
              ) : (
                negociacoesSemProximaAtividade.map((card) => (
                  <Link className="stat-row stat-row-link" href="/funil" key={card.id}>
                    <span className="sl">{card.nome}</span>
                    <span className="sv">{card.valor}</span>
                  </Link>
                ))
              )}
            </div>

            <div className="grid split2">
              <div className="card">
                <div className="panel-h">
                  <h4>Reuniões e e-mails</h4>
                </div>
                <div className="dados-nao-conectados" style={{ margin: 17 }}>
                  Dados não conectados — conecte agenda/e-mail pra ver reuniões e e-mails aqui.
                </div>
              </div>
              <div className="card">
                <div className="panel-h">
                  <h4>Documentos enviados</h4>
                </div>
                <div className="dados-nao-conectados" style={{ margin: 17 }}>
                  Dados não conectados — vincule documentos a conversas pra ver esse total aqui.
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
