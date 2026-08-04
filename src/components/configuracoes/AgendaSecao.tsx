"use client";

import { useState } from "react";

import { Toggle } from "@/components/ui";
import { useEquipe } from "@/lib/equipe-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type TipoCompromisso = { id: string; nome: string; duracao: number; cor: string; local: string; modalidade: string };
const TIPOS_INICIAIS: TipoCompromisso[] = [
  { id: "consulta", nome: "Consulta", duracao: 30, cor: "#2e6bff", local: "Sala 1", modalidade: "Presencial" },
  { id: "reuniao", nome: "Reunião", duracao: 45, cor: "#8a3ffc", local: "Sala de reuniões", modalidade: "Presencial" },
  { id: "visita", nome: "Visita técnica", duracao: 60, cor: "#d8a400", local: "No cliente", modalidade: "Externo" },
  { id: "demo", nome: "Demonstração", duracao: 30, cor: "#0f9d63", local: "Google Meet", modalidade: "Vídeo" },
  { id: "retorno", nome: "Retorno", duracao: 20, cor: "#0891b2", local: "Sala 2", modalidade: "Presencial" },
  { id: "avaliacao", nome: "Avaliação", duracao: 40, cor: "#d64545", local: "Sala 1", modalidade: "Presencial" },
];

/** Agenda e horários (item 31). */
export function AgendaSecao() {
  const { membros: equipe } = useEquipe();
  const [duracaoPadrao, setDuracaoPadrao] = useState(30);
  const [intervalo, setIntervalo] = useState(10);
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["Seg", "Ter", "Qua", "Qui", "Sex"]);
  const [antecedenciaMin, setAntecedenciaMin] = useState(60);
  const [prazoMax, setPrazoMax] = useState(30);
  const [permitirReagendar, setPermitirReagendar] = useState(true);
  const [permitirCancelar, setPermitirCancelar] = useState(true);
  const [lembreteAtivo, setLembreteAtivo] = useState(true);
  const [tipos, setTipos] = useState(TIPOS_INICIAIS);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Agenda e horários" descricao="Duração, horários e tipos de compromisso." />

      <div className="config-bloco">
        <div className="config-grid-2">
          <div className="field">
            <label>Duração padrão (minutos)</label>
            <input className="input" type="number" value={duracaoPadrao} onChange={(e) => setDuracaoPadrao(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Intervalo entre compromissos (minutos)</label>
            <input className="input" type="number" value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Antecedência mínima (minutos)</label>
            <input className="input" type="number" value={antecedenciaMin} onChange={(e) => setAntecedenciaMin(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Prazo máximo (dias)</label>
            <input className="input" type="number" value={prazoMax} onChange={(e) => setPrazoMax(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Dias disponíveis</label>
          <div className="filters-row">
            {DIAS.map((d) => (
              <button
                type="button"
                key={d}
                className={`fchip${diasAtivos.includes(d) ? " active" : ""}`}
                onClick={() => setDiasAtivos((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {[
          { label: "Permitir reagendamento pelo contato", valor: permitirReagendar, set: setPermitirReagendar },
          { label: "Permitir cancelamento pelo contato", valor: permitirCancelar, set: setPermitirCancelar },
          { label: "Lembrete automático (mockado)", valor: lembreteAtivo, set: setLembreteAtivo },
        ].map((item) => (
          <div className="toggle-row" key={item.label} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="tl">{item.label}</span>
            <Toggle defaultOn={item.valor} label={item.label} onToggle={item.set} />
          </div>
        ))}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Tipos de compromisso</p>
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Duração</th>
                <th>Local</th>
                <th>Modalidade</th>
                <th>Responsáveis</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t, i) => (
                <tr key={t.id}>
                  <td>
                    <span className="config-etiqueta-cor" style={{ background: t.cor, marginRight: 6 }} />
                    <input
                      className="input"
                      style={{ width: 140, display: "inline-block" }}
                      value={t.nome}
                      onChange={(e) => setTipos((prev) => prev.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                  </td>
                  <td>{t.duracao} min</td>
                  <td>{t.local}</td>
                  <td>{t.modalidade}</td>
                  <td>{equipe[i % equipe.length]?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
