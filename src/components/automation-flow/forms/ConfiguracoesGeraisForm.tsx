"use client";

import { DIAS_SEMANA, type DiaSemana } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import type { ConfiguracoesFluxo, FluxoAutomacao } from "@/lib/automation-flow/types";
import { SeletorDeData } from "@/components/seletor-de-data";

const LIMITES: { valor: NonNullable<ConfiguracoesFluxo["limiteExecucao"]>; label: string }[] = [
  { valor: "sempre", label: "Sempre que o gatilho acontecer" },
  { valor: "uma_vez_por_contato", label: "Uma vez por contato" },
  { valor: "uma_vez_por_entrada", label: "Uma vez por entrada na etapa" },
  { valor: "uma_vez_por_dia", label: "Uma vez por dia" },
  { valor: "uma_vez_por_semana", label: "Uma vez por semana" },
  { valor: "uma_vez_por_mes", label: "Uma vez por mês" },
];

export function ConfiguracoesGeraisForm({
  fluxo,
  onChange,
  onChangeConfiguracoes,
}: {
  fluxo: FluxoAutomacao;
  onChange: (patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) => void;
  onChangeConfiguracoes: (patch: Partial<ConfiguracoesFluxo>) => void;
}) {
  const { funis } = useFunis();
  const cfg = fluxo.configuracoes;
  const funilEscolhido = funis.find((f) => f.id === fluxo.funilId);

  function alternarDia(dia: DiaSemana) {
    const atuais = cfg.diasAtivos ?? [];
    const novo = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia];
    onChangeConfiguracoes({ diasAtivos: novo });
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Nome do fluxo</label>
        <input className="input" value={fluxo.nome} onChange={(e) => onChange({ nome: e.target.value })} />
      </div>
      <div className="field">
        <label>Descrição</label>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 60, resize: "vertical" }}
          value={fluxo.descricao ?? ""}
          onChange={(e) => onChange({ descricao: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Funil relacionado</label>
        <select className="input" value={fluxo.funilId ?? ""} onChange={(e) => onChange({ funilId: e.target.value || undefined, etapaId: undefined })}>
          <option value="">Nenhum específico</option>
          {funis.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
      {funilEscolhido ? (
        <div className="field">
          <label>Etapa relacionada</label>
          <select className="input" value={fluxo.etapaId ?? ""} onChange={(e) => onChange({ etapaId: e.target.value || undefined })}>
            <option value="">Qualquer etapa</option>
            {funilEscolhido.colunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label>Dias ativos</label>
        <div className="filters-row">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.valor}
              type="button"
              className={`fchip${(cfg.diasAtivos ?? []).includes(d.valor) ? " active" : ""}`}
              aria-pressed={(cfg.diasAtivos ?? []).includes(d.valor)}
              onClick={() => alternarDia(d.valor)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toggle-row">
        <span className="tl">Restringir a um horário</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.usarHorario}
          aria-label="Restringir a um horário"
          className={`toggle${cfg.usarHorario ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ usarHorario: !cfg.usarHorario })}
        >
          <span className="knob" />
        </button>
      </div>
      {cfg.usarHorario ? (
        <div className="field">
          <label>Janela de horário</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              type="time"
              style={{ flex: 1 }}
              value={cfg.horarioInicio ?? ""}
              onChange={(e) => onChangeConfiguracoes({ horarioInicio: e.target.value })}
            />
            <input
              className="input"
              type="time"
              style={{ flex: 1 }}
              value={cfg.horarioFim ?? ""}
              onChange={(e) => onChangeConfiguracoes({ horarioFim: e.target.value })}
            />
          </div>
        </div>
      ) : null}
      <div className="field">
        <label>Fuso horário</label>
        <input
          className="input"
          placeholder="America/Sao_Paulo"
          value={cfg.fusoHorario ?? ""}
          onChange={(e) => onChangeConfiguracoes({ fusoHorario: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Fora da janela ativa</label>
        <select
          className="input"
          value={cfg.foraDaJanela ?? "aguardar"}
          onChange={(e) => onChangeConfiguracoes({ foraDaJanela: e.target.value as ConfiguracoesFluxo["foraDaJanela"] })}
        >
          <option value="aguardar">Aguardar a próxima janela</option>
          <option value="ignorar">Ignorar o disparo</option>
        </select>
      </div>

      <div className="field">
        <label>Data de início</label>
        <SeletorDeData valor={cfg.dataInicio ?? ""} onChange={(iso) => onChangeConfiguracoes({ dataInicio: iso })} />
      </div>
      <div className="field">
        <label>Data de fim</label>
        <SeletorDeData valor={cfg.dataFim ?? ""} onChange={(iso) => onChangeConfiguracoes({ dataFim: iso })} />
      </div>

      <div className="field">
        <label>Prioridade</label>
        <select className="input" value={cfg.prioridade ?? "normal"} onChange={(e) => onChangeConfiguracoes({ prioridade: e.target.value as ConfiguracoesFluxo["prioridade"] })}>
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
        </select>
      </div>

      <div className="field">
        <label>Limite de execução</label>
        <select
          className="input"
          value={cfg.limiteExecucao ?? "sempre"}
          onChange={(e) => onChangeConfiguracoes({ limiteExecucao: e.target.value as ConfiguracoesFluxo["limiteExecucao"] })}
        >
          {LIMITES.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toggle-row">
        <span className="tl">Não iniciar se já estiver nesse fluxo</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.naoIniciarSeJaNoFluxo}
          aria-label="Não iniciar se já estiver nesse fluxo"
          className={`toggle${cfg.naoIniciarSeJaNoFluxo ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ naoIniciarSeJaNoFluxo: !cfg.naoIniciarSeJaNoFluxo })}
        >
          <span className="knob" />
        </button>
      </div>
      <div className="toggle-row">
        <span className="tl">Cancelar execução anterior ao reiniciar</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.cancelarExecucaoAnterior}
          aria-label="Cancelar execução anterior ao reiniciar"
          className={`toggle${cfg.cancelarExecucaoAnterior ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ cancelarExecucaoAnterior: !cfg.cancelarExecucaoAnterior })}
        >
          <span className="knob" />
        </button>
      </div>
    </div>
  );
}
