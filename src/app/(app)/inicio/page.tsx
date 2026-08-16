"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

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

const PRIORIDADE_PESO: Record<ItemDia["prioridade"], number> = {
  urgente: 0,
  atencao: 1,
  oportunidade: 2,
};

/** Origens pagas (tráfego/anúncios) — o resto (Direto, Instagram, TikTok, Indicação, Formulário…)
 * entra em "Outros". Hoje só o Meta Ads grava atribuição real em `Conversa.origem`; Google Ads fica
 * zerado até essa integração existir — número real, não fictício, mesmo que comece em zero. */
function ehOrigemPaga(origem: string): boolean {
  return origem === "Meta Ads" || origem === "Google Ads";
}

function ehHoje(dataIso: string): boolean {
  const d = new Date(dataIso);
  const agora = new Date();
  return (
    d.getFullYear() === agora.getFullYear() &&
    d.getMonth() === agora.getMonth() &&
    d.getDate() === agora.getDate()
  );
}

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

  const itensParaPendencias = useMemo(
    () => [...itensFiltrados].sort((a, b) => PRIORIDADE_PESO[a.prioridade] - PRIORIDADE_PESO[b.prioridade]),
    [itensFiltrados],
  );

  const tarefasSecao = itensFiltrados.filter((i) => i.modulo === "tarefa");
  const recomendacoes = useMemo(
    () => gerarRecomendacoes(itensAtivos, compromissosHoje),
    [itensAtivos, compromissosHoje],
  );

  const atrasadosCount =
    tarefasSecao.filter((t) => t.tipo === "Tarefa atrasada").length +
    compromissosHoje.filter((c) => c.status === "Atrasado").length;
  const urgentesCount = itensFiltrados.filter((i) => i.prioridade === "urgente").length;

  const tudoConcluido = itensFiltrados.length === 0 && compromissosHoje.length === 0 && concluidos.length > 0;

  /** Leads que entraram hoje (conversa criada de verdade hoje), divididos por origem — atualiza
   * sozinho conforme `useConversas()` recebe mensagem nova (mesmo hook que alimenta o resto do
   * app). `Conversa.criadoEm` é timestamp real de banco, por isso compara contra a data real de
   * agora, não contra o "HOJE" simulado que a agenda mockada usa. */
  const leadsHoje = useMemo(() => {
    const criadasHoje = conversas.filter((c) => ehHoje(c.criadoEm));
    const trafego = criadasHoje.filter((c) => ehOrigemPaga(c.origem)).length;
    return { trafego, outros: criadasHoje.length - trafego };
  }, [conversas]);

  /** Oportunidades = negócios abertos que já saíram da 1ª etapa do funil (não são mais "lead novo",
   * viraram negociação/atendimento/fechamento). Vendas ganhas/perdidas = `NegocioCard.statusFechamento`
   * real, o mesmo campo que o Funil grava ao marcar "ganho"/"perdido". */
  const funilStats = useMemo(() => {
    let oportunidades = 0;
    let ganhas = 0;
    let perdidas = 0;
    for (const funil of funis) {
      funil.colunas.forEach((coluna, idx) => {
        for (const card of coluna.cards) {
          if (card.statusFechamento === "ganho") ganhas++;
          else if (card.statusFechamento === "perdido") perdidas++;
          else if (idx > 0) oportunidades++;
        }
      });
    }
    return { oportunidades, ganhas, perdidas };
  }, [funis]);

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

        <div className="inicio-grid-principal">
          <div className="inicio-col-lateral">
            <section className="central-dia-secao inicio-leads-box">
              <div className="central-dia-secao-h">
                <h3>Leads hoje</h3>
              </div>
              <div className="inicio-leads-linha">
                <span className="n">{leadsHoje.trafego}</span>
                <span className="r">Tráfego/Anúncios</span>
              </div>
              <div className="inicio-leads-linha">
                <span className="n">{leadsHoje.outros}</span>
                <span className="r">Outros</span>
              </div>
            </section>
          </div>

          <div className="inicio-col-central">
            {tudoConcluido ? (
              <div className="central-dia-vazio-geral">
                <p className="n">Você concluiu todas as prioridades de hoje.</p>
                <p className="r">Bom trabalho! Novos itens aparecem aqui conforme chegam.</p>
                <button type="button" className="btn ghost">
                  Ver esta semana
                </button>
              </div>
            ) : (
              <SecaoLista
                titulo="Pendências"
                contagem={itensParaPendencias.length + compromissosHoje.length}
                vazio={<p className="hint">Nada pendente por aqui agora.</p>}
              >
                {itensParaPendencias.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
                {compromissosHoje.map((c) => (
                  <CompromissoCard key={c.id} compromisso={c} />
                ))}
              </SecaoLista>
            )}
          </div>

          <div className="inicio-col-lateral">
            <Link href="/funil" className="inicio-stat-mini">
              <span className="n">{funilStats.oportunidades}</span>
              <span className="r">Oportunidades</span>
            </Link>
            <Link href="/motivos-perda" className="inicio-stat-mini is-perdido">
              <span className="n">{funilStats.perdidas}</span>
              <span className="r">Vendas perdidas</span>
            </Link>
            <Link href="/performance-vendas" className="inicio-stat-mini is-ganho">
              <span className="n">{funilStats.ganhas}</span>
              <span className="r">Vendas realizadas</span>
            </Link>
          </div>
        </div>

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
