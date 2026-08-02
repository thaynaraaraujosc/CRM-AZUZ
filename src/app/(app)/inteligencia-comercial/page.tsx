"use client";

import Link from "next/link";

import { tarefas } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { Topbar, KpiCard } from "@/components/ui";
import {
  calcularFunilResumo,
  calcularMotivoPrincipalPerda,
  calcularOportunidadesContatadas,
  calcularTaxaConversao,
  calcularTempoMedioPrimeiroContato,
  calcularTicketMedio,
  calcularValorPerdido,
  calcularValorVendido,
} from "@/lib/metrics";

/**
 * Visão geral da Inteligência comercial — todo cartão aqui vem de
 * `src/lib/metrics.ts` (uma função, uma fórmula, um resultado) e é
 * clicável, abrindo os registros reais que formaram o número. Nenhum valor
 * nessa tela é digitado à mão.
 */
export default function InteligenciaComercialPage() {
  const { funis } = useFunis();

  const funilResumo = calcularFunilResumo();
  const contatadas = calcularOportunidadesContatadas();
  const tempoResposta = calcularTempoMedioPrimeiroContato();
  const taxaConversao = calcularTaxaConversao();
  const valorVendido = calcularValorVendido();
  const ticketMedio = calcularTicketMedio();
  const valorPerdido = calcularValorPerdido();
  const motivoPrincipal = calcularMotivoPrincipalPerda();

  const colunaAtrasadas = tarefas.find((c) => c.titulo === "Atrasadas");
  const colunaHoje = tarefas.find((c) => c.titulo === "Hoje");
  const tarefasAtrasadas = colunaAtrasadas?.cards ?? [];
  const tarefasPendentes = tarefas
    .filter((c) => c.titulo !== "Concluídas")
    .flatMap((c) => c.cards);

  const negociacoesAbertas = funis.flatMap((f) =>
    f.colunas.filter((c) => !c.titulo.startsWith("Fechado")).flatMap((c) => c.cards),
  );

  const negociacoesParadas = funis.flatMap((f) =>
    f.colunas
      .filter((c) => !c.titulo.startsWith("Fechado"))
      .flatMap((c) => c.cards)
      .filter((card) => {
        const m = card.dias.match(/(\d+)\s*dias?/i);
        return m ? Number(m[1]) >= 3 : false;
      }),
  );

  return (
    <>
      <Topbar
        title="Visão geral"
        sub="Inteligência comercial — todo indicador aqui vem da mesma base de dados do CRM, sem número simulado"
      />

      <div className="content">
        <div className="grid kpi4">
          <KpiCard
            label="Novos leads"
            value={funilResumo.label}
            sub="Etapa &quot;Novo&quot; do funil"
            formula={funilResumo.formula}
            href="/funil"
          />
          <KpiCard
            label="Oportunidades contatadas"
            value={contatadas.label}
            formula={contatadas.formula}
            href="/atividades-vendas"
          />
          <KpiCard
            label="Tempo médio de resposta"
            value={tempoResposta.label}
            formula={tempoResposta.formula}
            href="/atividades-vendas"
          />
          <KpiCard
            label="Taxa de conversão"
            value={taxaConversao.label}
            formula={taxaConversao.formula}
            href="/performance-vendas"
          />
          <KpiCard
            label="Negociações abertas"
            value={String(negociacoesAbertas.length)}
            sub="Em qualquer etapa que não seja fechamento"
            formula="Contagem de negociações em todas as etapas exceto a de fechamento, em todos os funis"
            href="/funil"
          />
          <KpiCard
            label="Vendas no período"
            value={valorVendido.label}
            formula={valorVendido.formula}
            href="/performance-vendas"
          />
          <KpiCard
            label="Ticket médio"
            value={ticketMedio.label}
            formula={ticketMedio.formula}
            href="/relatorios"
          />
          <KpiCard
            label="Valor perdido"
            value={valorPerdido.label}
            sub={`Principal motivo: ${motivoPrincipal.motivo}`}
            formula={valorPerdido.formula}
            href="/performance-vendas?aba=motivos-perda"
          />
          <KpiCard
            label="Tarefas pendentes"
            value={String(tarefasPendentes.length)}
            formula="Contagem de tarefas em qualquer coluna que não seja &quot;Concluídas&quot;"
            href="/tarefas"
          />
          <KpiCard
            label="Tarefas atrasadas"
            value={String(tarefasAtrasadas.length)}
            formula="Contagem de tarefas na coluna &quot;Atrasadas&quot;"
            href="/tarefas"
          />
        </div>

        <div className="card mt14">
          <div className="panel-h">
            <h4>Alertas</h4>
            <p className="hint">Gerados a partir de tarefas e negociações reais — clique pra agir</p>
          </div>
          <div style={{ padding: 17 }}>
            {tarefasAtrasadas.length === 0 && negociacoesParadas.length === 0 ? (
              <p className="hint">Nenhum alerta no momento.</p>
            ) : null}
            {tarefasAtrasadas.map((t) => (
              <Link key={t.id} href="/tarefas" className="camp-row" style={{ textDecoration: "none" }}>
                <div className="camp-body">
                  <p className="camp-name">⏰ Tarefa atrasada: {t.titulo}</p>
                  <p className="hint" style={{ margin: 0 }}>
                    {t.contato} · responsável: {t.responsavel.nome}
                  </p>
                </div>
                <span className="camp-num">Ver tarefa</span>
              </Link>
            ))}
            {negociacoesParadas.map((card) => (
              <Link key={card.id} href="/funil" className="camp-row" style={{ textDecoration: "none" }}>
                <div className="camp-body">
                  <p className="camp-name">⚠ Negociação parada há {card.dias}: {card.nome}</p>
                  <p className="hint" style={{ margin: 0 }}>Origem: {card.origem}</p>
                </div>
                <span className="camp-num">Ver no funil</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card mt14">
          <div className="panel-h">
            <h4>Jornada do cliente</h4>
          </div>
          <div style={{ padding: 17 }}>
            <p className="hint" style={{ marginBottom: 12 }}>
              Veja a linha do tempo completa de qualquer contato — todas as mensagens, tarefas,
              mudanças de etapa e negociações num só lugar.
            </p>
            <Link href="/jornada-cliente" className="btn primary">
              Abrir jornada do cliente
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
