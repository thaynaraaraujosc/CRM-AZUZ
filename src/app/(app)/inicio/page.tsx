"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { IconRefresh } from "@/components/icons";
import { CompromissoCard } from "@/components/central-dia/CompromissoCard";
import { ConcluidosHoje } from "@/components/central-dia/ConcluidosHoje";
import { FiltrosBar } from "@/components/central-dia/FiltrosBar";
import { ItemCard } from "@/components/central-dia/ItemCard";
import { OrganizarMeuDia } from "@/components/central-dia/OrganizarMeuDia";
import { Recomendacoes } from "@/components/central-dia/Recomendacoes";
import { SecaoLista } from "@/components/central-dia/SecaoLista";
import { useCentralDia } from "@/lib/central-dia-context";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { compromissosDeTarefas, HOJE_ISO, useAgenda } from "@/lib/agenda-context";
import { useConversas } from "@/lib/conversas-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useFunis } from "@/lib/funis-context";
import { useTarefas } from "@/lib/tarefas-context";
import {
  compromissosDoDia,
  gerarRecomendacoes,
  itensDeAutomacoes,
  itensDeConversas,
  itensDeLeads,
  itensDeTarefas,
} from "@/lib/central-dia/mock";
import type { ItemDia, ModuloOrigem } from "@/lib/central-dia/tipos";

const MODULO_DO_FILTRO_RAPIDO: Record<string, ModuloOrigem | undefined> = {
  Conversas: "conversa",
  Tarefas: "tarefa",
  Leads: "lead",
  Automações: "automacao",
};

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function tempoDesde(timestamp: number): string {
  const segundos = Math.floor((Date.now() - timestamp) / 1000);
  if (segundos < 60) return "poucos segundos";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas}h`;
}

/**
 * Central do Dia — substitui a antiga "Visão geral" (que duplicava gráficos já existentes em
 * Inteligência Comercial). A pergunta que essa página responde agora é só uma: "o que precisa ser
 * feito hoje?". Todo item é derivado de dados reais de outros módulos (`@/lib/central-dia/mock`) —
 * a única exceção documentada é a agenda mockada (o CRM ainda não tem um módulo de compromissos com
 * hora/local) e as recomendações (regras locais, não IA de verdade).
 */
export default function InicioPage() {
  const { data: sessao } = useSession();
  const nomeUsuario = sessao?.user?.name ?? "";
  const { funis } = useFunis();
  const { fluxos } = useAutomationFlows();
  const { colunas } = useTarefas();
  const { compromissos } = useAgenda();
  const { conversas } = useConversas();
  const { mensagensExtraPorContato } = useMensagensExtra();
  const { filtros, concluidos, adiados, ultimaAtualizacao, atualizando, atualizarAgora } = useCentralDia();
  const [organizarAberto, setOrganizarAberto] = useState(false);

  const itensBase = useMemo(
    () => [
      ...itensDeConversas(conversas, mensagensExtraPorContato),
      ...itensDeTarefas(colunas),
      ...itensDeLeads(funis),
      ...itensDeAutomacoes(fluxos),
    ],
    [conversas, mensagensExtraPorContato, colunas, funis, fluxos],
  );

  const compromissosHoje = useMemo(
    () => compromissosDoDia([...compromissos, ...compromissosDeTarefas(colunas)], HOJE_ISO),
    [compromissos, colunas],
  );

  const concluidosIds = useMemo(() => new Set(concluidos.map((c) => c.itemId)), [concluidos]);
  const adiadosIds = useMemo(() => new Set(adiados.map((a) => a.itemId)), [adiados]);

  const itensAtivos = useMemo(
    () => itensBase.filter((i) => !concluidosIds.has(i.id) && !adiadosIds.has(i.id)),
    [itensBase, concluidosIds, adiadosIds],
  );

  const itensFiltrados = useMemo(() => {
    return itensAtivos.filter((item) => {
      if (filtros.rapido === "Meus itens" && item.responsavel !== nomeUsuario) return false;
      if (filtros.rapido === "Urgentes" && item.prioridade !== "urgente") return false;
      const moduloAlvo = MODULO_DO_FILTRO_RAPIDO[filtros.rapido];
      if (moduloAlvo && item.modulo !== moduloAlvo) return false;
      if (filtros.responsavel !== "Todos" && item.responsavel !== filtros.responsavel) return false;
      if (filtros.prioridade !== "Todas" && item.prioridade !== filtros.prioridade) return false;
      if (filtros.funil !== "Todos" && item.modulo === "lead" && item.extra?.funil !== filtros.funil) return false;
      return true;
    });
  }, [itensAtivos, filtros, nomeUsuario]);

  const mostrarAgenda = filtros.rapido === "Todos" || filtros.rapido === "Agenda" || filtros.rapido === "Meus itens" || filtros.rapido === "Minha equipe" || filtros.rapido === "Urgentes";
  const mostrarModulo = (modulo: ModuloOrigem) =>
    !MODULO_DO_FILTRO_RAPIDO[filtros.rapido] || MODULO_DO_FILTRO_RAPIDO[filtros.rapido] === modulo;

  const grupos: { chave: ItemDia["prioridade"]; titulo: string; vazio: string }[] = [
    { chave: "urgente", titulo: "Urgente", vazio: "Nenhum item urgente no momento." },
    { chave: "atencao", titulo: "Precisa de atenção", vazio: "Nada precisando de atenção agora." },
    { chave: "oportunidade", titulo: "Oportunidades", vazio: "Nenhuma oportunidade identificada agora." },
  ];

  const conversasSecao = itensFiltrados.filter((i) => i.modulo === "conversa");
  const tarefasSecao = itensFiltrados.filter((i) => i.modulo === "tarefa");
  const leadsSecao = itensFiltrados.filter((i) => i.modulo === "lead");
  const automacoesSecao = itensFiltrados.filter((i) => i.modulo === "automacao");
  const recomendacoes = useMemo(
    () => gerarRecomendacoes(itensAtivos, compromissosHoje),
    [itensAtivos, compromissosHoje],
  );

  const atrasadosCount =
    tarefasSecao.filter((t) => t.tipo === "Tarefa atrasada").length +
    compromissosHoje.filter((c) => c.status === "Atrasado").length;
  const urgentesCount = itensFiltrados.filter((i) => i.prioridade === "urgente").length;

  const tudoConcluido = itensFiltrados.length === 0 && concluidos.length > 0;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>
              {saudacao()}, {nomeUsuario.split(" ")[0]}.
            </h2>
          </div>
          <p className="sub">
            Você possui {itensFiltrados.length} {itensFiltrados.length === 1 ? "item" : "itens"} que precisa
            {itensFiltrados.length === 1 ? "" : "m"} da sua atenção hoje.
          </p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn primary" onClick={() => setOrganizarAberto(true)}>
            Organizar meu dia
          </button>
        </div>
      </div>

      <div className="content">
        <div className="central-dia-resumo">
          <div className="central-dia-resumo-item">
            <span className="n">{itensFiltrados.length}</span>
            <span className="r">Pendentes</span>
          </div>
          <div className="central-dia-resumo-item is-urgente">
            <span className="n">{urgentesCount}</span>
            <span className="r">Urgentes</span>
          </div>
          <div className="central-dia-resumo-item is-concluido">
            <span className="n">{concluidos.length}</span>
            <span className="r">Concluídos</span>
          </div>
          <div className="central-dia-resumo-item is-atrasado">
            <span className="n">{atrasadosCount}</span>
            <span className="r">Atrasados</span>
          </div>
          <div className="central-dia-resumo-atualizacao">
            <span className="hint">Atualizado há {tempoDesde(ultimaAtualizacao)}</span>
            <button type="button" className="icon-btn subtle" aria-label="Atualizar" onClick={atualizarAgora} disabled={atualizando}>
              <IconRefresh width={15} height={15} className={atualizando ? "spin" : ""} />
            </button>
          </div>
        </div>

        <FiltrosBar />

        {tudoConcluido ? (
          <div className="central-dia-vazio-geral">
            <p className="n">Você concluiu todas as prioridades de hoje.</p>
            <p className="r">Bom trabalho! Novos itens aparecem aqui conforme chegam.</p>
            <button type="button" className="btn ghost">
              Ver esta semana
            </button>
          </div>
        ) : (
          grupos.map((g) => {
            const itensGrupo = itensFiltrados.filter((i) => i.prioridade === g.chave);
            return (
              <SecaoLista key={g.chave} titulo={g.titulo} contagem={itensGrupo.length} vazio={<p className="hint">{g.vazio}</p>}>
                {itensGrupo.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </SecaoLista>
            );
          })
        )}

        {mostrarModulo("conversa") ? (
          <SecaoLista
            titulo="Conversas aguardando resposta"
            contagem={conversasSecao.length}
            vazio={<p className="hint">Nenhuma conversa esperando resposta agora.</p>}
          >
            {conversasSecao.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </SecaoLista>
        ) : null}

        {mostrarAgenda ? (
          <SecaoLista titulo="Agenda de hoje" contagem={compromissosHoje.length} vazio={<p className="hint">Nenhum compromisso hoje.</p>}>
            {compromissosHoje.map((c) => (
              <CompromissoCard key={c.id} compromisso={c} />
            ))}
          </SecaoLista>
        ) : null}

        {mostrarModulo("tarefa") ? (
          <SecaoLista titulo="Tarefas" contagem={tarefasSecao.length} vazio={<p className="hint">Nenhuma tarefa pendente.</p>}>
            {tarefasSecao.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </SecaoLista>
        ) : null}

        {mostrarModulo("lead") ? (
          <SecaoLista
            titulo="Leads que precisam de ação"
            contagem={leadsSecao.length}
            vazio={<p className="hint">Nenhum lead precisando de ação agora.</p>}
          >
            {leadsSecao.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </SecaoLista>
        ) : null}

        {mostrarModulo("automacao") ? (
          <SecaoLista
            titulo="Automações que precisam de atenção"
            contagem={automacoesSecao.length}
            vazio={<p className="hint">Nenhuma automação com pendência agora.</p>}
          >
            {automacoesSecao.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </SecaoLista>
        ) : null}

        <Recomendacoes recomendacoes={recomendacoes} onVerItens={() => {}} />

        <ConcluidosHoje />
      </div>

      <OrganizarMeuDia
        aberto={organizarAberto}
        onFechar={() => setOrganizarAberto(false)}
        itensSugeridos={[...itensFiltrados].sort((a, b) => (a.prioridade === b.prioridade ? 0 : a.prioridade === "urgente" ? -1 : 1))}
      />
    </>
  );
}
