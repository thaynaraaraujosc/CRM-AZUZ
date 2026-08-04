"use client";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import type { EncaminharHumanoData, MetodoDistribuicaoAtendimento, ModoDestinoAtendimento } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";

const DESTINOS: { valor: ModoDestinoAtendimento; label: string }[] = [
  { valor: "atendente", label: "Atendente específico" },
  { valor: "equipe", label: "Equipe" },
  { valor: "distribuicao", label: "Distribuição automática" },
  { valor: "manter", label: "Manter responsável atual" },
];

const METODOS: { valor: MetodoDistribuicaoAtendimento; label: string }[] = [
  { valor: "disponibilidade", label: "Por disponibilidade" },
  { valor: "rodizio", label: "Rodízio" },
  { valor: "menos_atendimentos", label: "Menor quantidade de atendimentos" },
  { valor: "prioridade", label: "Prioridade definida" },
];

/** Ação "Encaminhar pra atendimento humano" (item 1) — obriga escolher pra onde o lead vai, e
 * opcionalmente move ele de etapa/funil junto. */
export function EncaminharHumanoForm({ data, onChange }: { data: EncaminharHumanoData; onChange: (novo: EncaminharHumanoData) => void }) {
  const { funis } = useFunis();
  const { membros } = useEquipe();
  const equipes = useEquipesDisponiveis();
  const funilEscolhido = funis.find((f) => f.id === data.funilId);

  return (
    <div className="flow-form">
      <div className="field">
        <label>Destino do atendimento</label>
        <select className="input" value={data.destino} onChange={(e) => onChange({ ...data, destino: e.target.value as ModoDestinoAtendimento })}>
          {DESTINOS.map((d) => (
            <option key={d.valor} value={d.valor}>{d.label}</option>
          ))}
        </select>
      </div>

      {data.destino === "atendente" ? (
        <div className="field">
          <label>Atendente</label>
          <select className="input" value={data.atendenteNome ?? ""} onChange={(e) => onChange({ ...data, atendenteNome: e.target.value })}>
            <option value="">Selecionar atendente…</option>
            {membros.map((m) => (
              <option key={m.id} value={m.nome}>{m.nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.destino === "equipe" ? (
        <div className="field">
          <label>Equipe</label>
          <select className="input" value={data.equipeNome ?? ""} onChange={(e) => onChange({ ...data, equipeNome: e.target.value })}>
            <option value="">Selecionar equipe…</option>
            {equipes.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.destino === "distribuicao" ? (
        <div className="field">
          <label>Método</label>
          <select className="input" value={data.metodoDistribuicao ?? "disponibilidade"} onChange={(e) => onChange({ ...data, metodoDistribuicao: e.target.value as MetodoDistribuicaoAtendimento })}>
            {METODOS.map((m) => (
              <option key={m.valor} value={m.valor}>{m.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="toggle-row">
        <span className="tl">Mover o lead no funil após encaminhar?</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.moverFunil}
          className={`toggle${data.moverFunil ? " on" : ""}`}
          onClick={() => onChange({ ...data, moverFunil: !data.moverFunil })}
        >
          <span className="knob" />
        </button>
      </div>

      {data.moverFunil ? (
        <>
          <div className="field">
            <label>Funil</label>
            <select className="input" value={data.funilId ?? ""} onChange={(e) => onChange({ ...data, funilId: e.target.value, etapaTitulo: "" })}>
              <option value="">Selecione um funil…</option>
              {funis.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Etapa</label>
            <select className="input" value={data.etapaTitulo ?? ""} onChange={(e) => onChange({ ...data, etapaTitulo: e.target.value })} disabled={!funilEscolhido}>
              <option value="">{funilEscolhido ? "Selecione uma etapa…" : "Escolha um funil primeiro"}</option>
              {(funilEscolhido?.colunas ?? []).map((c) => (
                <option key={c.id} value={c.titulo}>{c.titulo}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div className="field">
        <label>Quando executar</label>
        <select className="input" value={data.quandoModo ?? "imediato"} onChange={(e) => onChange({ ...data, quandoModo: e.target.value as "imediato" | "apos_tempo" })}>
          <option value="imediato">Imediatamente</option>
          <option value="apos_tempo">Após determinado tempo</option>
        </select>
      </div>

      {data.quandoModo === "apos_tempo" ? (
        <div className="field" style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            type="number"
            min={1}
            style={{ flex: 1 }}
            value={data.tempoValor ?? ""}
            onChange={(e) => onChange({ ...data, tempoValor: e.target.value ? Number(e.target.value) : undefined })}
          />
          <select className="input" style={{ flex: 1 }} value={data.tempoUnidade ?? "minutos"} onChange={(e) => onChange({ ...data, tempoUnidade: e.target.value })}>
            <option value="minutos">Minutos</option>
            <option value="horas">Horas</option>
            <option value="dias">Dias</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
