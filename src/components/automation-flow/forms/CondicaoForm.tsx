"use client";

import type {
  CampoCondicao,
  GrupoCondicoes,
  OperadorCondicao,
  RegraCondicao,
} from "@/lib/automation-flow/types";

const CAMPOS: { valor: CampoCondicao; label: string }[] = [
  { valor: "origem", label: "Origem" },
  { valor: "canal", label: "Canal" },
  { valor: "etapa", label: "Etapa" },
  { valor: "funil", label: "Funil" },
  { valor: "etiqueta", label: "Etiqueta" },
  { valor: "responsavel", label: "Responsável" },
  { valor: "equipe", label: "Equipe" },
  { valor: "numero_salvo", label: "Número salvo" },
  { valor: "campo_personalizado", label: "Campo personalizado" },
  { valor: "cidade", label: "Cidade" },
  { valor: "estado", label: "Estado" },
  { valor: "data_ultima_conversa", label: "Data da última conversa" },
  { valor: "horario_ultima_mensagem", label: "Horário da última mensagem" },
  { valor: "respondeu", label: "Respondeu" },
  { valor: "tentativas", label: "Tentativas" },
  { valor: "recebeu_automacao", label: "Recebeu automação" },
  { valor: "em_outra_automacao", label: "Está em outra automação" },
  { valor: "possui_agendamento", label: "Possui agendamento" },
  { valor: "situacao_agendamento", label: "Situação do agendamento" },
  { valor: "valor_negocio", label: "Valor do negócio" },
  { valor: "campanha", label: "Campanha" },
  { valor: "anuncio", label: "Anúncio" },
  { valor: "palavra_chave", label: "Palavra-chave" },
  { valor: "consentimento", label: "Consentimento" },
  { valor: "dia_semana", label: "Dia da semana" },
  { valor: "horario", label: "Horário" },
];

const OPERADORES: { valor: OperadorCondicao; label: string }[] = [
  { valor: "igual", label: "é igual a" },
  { valor: "diferente", label: "é diferente de" },
  { valor: "contem", label: "contém" },
  { valor: "nao_contem", label: "não contém" },
  { valor: "comeca_com", label: "começa com" },
  { valor: "termina_com", label: "termina com" },
  { valor: "maior_que", label: "maior que" },
  { valor: "menor_que", label: "menor que" },
  { valor: "entre", label: "entre" },
  { valor: "existe", label: "existe" },
  { valor: "nao_existe", label: "não existe" },
];

let contador = 0;
function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${Date.now()}-${contador}`;
}

export function novoGrupoCondicoes(): GrupoCondicoes {
  return { id: novoId("grupo"), tipo: "E", regras: [], subgrupos: [] };
}

function novaRegra(): RegraCondicao {
  return { id: novoId("regra"), campo: "origem", operador: "igual", valor: "" };
}

/** Editor recursivo de `GrupoCondicoes` — E/OU/NÃO + regras + subgrupos aninhados. */
export function CondicaoForm({
  grupo,
  onChange,
  nivel = 0,
}: {
  grupo: GrupoCondicoes;
  onChange: (novo: GrupoCondicoes) => void;
  nivel?: number;
}) {
  function atualizarRegra(id: string, patch: Partial<RegraCondicao>) {
    onChange({ ...grupo, regras: grupo.regras.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removerRegra(id: string) {
    onChange({ ...grupo, regras: grupo.regras.filter((r) => r.id !== id) });
  }
  function atualizarSubgrupo(id: string, novo: GrupoCondicoes) {
    onChange({ ...grupo, subgrupos: grupo.subgrupos.map((g) => (g.id === id ? novo : g)) });
  }
  function removerSubgrupo(id: string) {
    onChange({ ...grupo, subgrupos: grupo.subgrupos.filter((g) => g.id !== id) });
  }

  return (
    <div className="flow-cond-grupo" style={{ marginLeft: nivel > 0 ? 12 : 0 }}>
      <div className="flow-cond-grupo-h">
        <div className="seg-picker" role="group" aria-label="Tipo do grupo de condições">
          {(["E", "OU", "NAO"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={`seg-chip${grupo.tipo === tipo ? " on" : ""}`}
              aria-pressed={grupo.tipo === tipo}
              onClick={() => onChange({ ...grupo, tipo })}
            >
              {tipo === "NAO" ? "NÃO" : tipo}
            </button>
          ))}
        </div>
      </div>

      {grupo.regras.map((regra) => (
        <div className="flow-cond-regra" key={regra.id}>
          <select
            className="input"
            value={regra.campo}
            onChange={(e) => atualizarRegra(regra.id, { campo: e.target.value as CampoCondicao })}
            aria-label="Campo da condição"
          >
            {CAMPOS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
          {regra.campo === "campo_personalizado" ? (
            <input
              className="input"
              placeholder="Nome do campo"
              value={regra.campoPersonalizadoNome ?? ""}
              onChange={(e) => atualizarRegra(regra.id, { campoPersonalizadoNome: e.target.value })}
              aria-label="Nome do campo personalizado"
            />
          ) : null}
          <select
            className="input"
            value={regra.operador}
            onChange={(e) => atualizarRegra(regra.id, { operador: e.target.value as OperadorCondicao })}
            aria-label="Operador"
          >
            {OPERADORES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
          {regra.operador !== "existe" && regra.operador !== "nao_existe" ? (
            <input
              className="input"
              placeholder="Valor"
              value={regra.valor ?? ""}
              onChange={(e) => atualizarRegra(regra.id, { valor: e.target.value })}
              aria-label="Valor"
            />
          ) : null}
          {regra.operador === "entre" ? (
            <input
              className="input"
              placeholder="Até"
              value={regra.valorFim ?? ""}
              onChange={(e) => atualizarRegra(regra.id, { valorFim: e.target.value })}
              aria-label="Valor final (entre)"
            />
          ) : null}
          <button
            type="button"
            className="remove-chip"
            aria-label="Remover regra"
            onClick={() => removerRegra(regra.id)}
          >
            ✕
          </button>
        </div>
      ))}

      {grupo.subgrupos.map((sub) => (
        <div className="flow-cond-subgrupo" key={sub.id}>
          <CondicaoForm grupo={sub} onChange={(novo) => atualizarSubgrupo(sub.id, novo)} nivel={nivel + 1} />
          <button
            type="button"
            className="btn ghost mt8"
            onClick={() => removerSubgrupo(sub.id)}
          >
            Remover subgrupo
          </button>
        </div>
      ))}

      <div className="flow-cond-acoes">
        <button
          type="button"
          className="btn ghost"
          onClick={() => onChange({ ...grupo, regras: [...grupo.regras, novaRegra()] })}
        >
          + Regra
        </button>
        {nivel < 2 ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => onChange({ ...grupo, subgrupos: [...grupo.subgrupos, novoGrupoCondicoes()] })}
          >
            + Subgrupo
          </button>
        ) : null}
      </div>
    </div>
  );
}
