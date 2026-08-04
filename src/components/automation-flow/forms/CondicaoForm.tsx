"use client";

import { useMemo } from "react";

import { contatos, equipe } from "@/lib/data";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { useFunis } from "@/lib/funis-context";
import type {
  CampoCondicao,
  GrupoCondicoes,
  OperadorCondicao,
  RegraCondicao,
} from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";

type CategoriaCampo = "Conversa" | "Funil / Negócio" | "Contato" | "Atividade";

const CAMPOS: { valor: CampoCondicao; label: string; categoria: CategoriaCampo }[] = [
  { valor: "canal", label: "Canal", categoria: "Conversa" },
  { valor: "numero_salvo", label: "Número salvo", categoria: "Conversa" },
  { valor: "data_ultima_conversa", label: "Data da última conversa", categoria: "Conversa" },
  { valor: "horario_ultima_mensagem", label: "Horário da última mensagem", categoria: "Conversa" },
  { valor: "respondeu", label: "Respondeu", categoria: "Conversa" },
  { valor: "tentativas", label: "Tentativas", categoria: "Conversa" },
  { valor: "recebeu_automacao", label: "Recebeu automação", categoria: "Conversa" },
  { valor: "em_outra_automacao", label: "Está em outra automação", categoria: "Conversa" },
  { valor: "palavra_chave", label: "Palavra-chave", categoria: "Conversa" },

  { valor: "etapa", label: "Etapa", categoria: "Funil / Negócio" },
  { valor: "funil", label: "Funil", categoria: "Funil / Negócio" },
  { valor: "valor_negocio", label: "Valor do negócio", categoria: "Funil / Negócio" },

  { valor: "origem", label: "Origem", categoria: "Contato" },
  { valor: "etiqueta", label: "Etiqueta", categoria: "Contato" },
  { valor: "responsavel", label: "Responsável", categoria: "Contato" },
  { valor: "equipe", label: "Equipe", categoria: "Contato" },
  { valor: "cidade", label: "Cidade", categoria: "Contato" },
  { valor: "estado", label: "Estado", categoria: "Contato" },
  { valor: "campanha", label: "Campanha", categoria: "Contato" },
  { valor: "anuncio", label: "Anúncio", categoria: "Contato" },
  { valor: "consentimento", label: "Consentimento", categoria: "Contato" },
  { valor: "campo_personalizado", label: "Campo personalizado", categoria: "Contato" },

  { valor: "possui_agendamento", label: "Possui agendamento", categoria: "Atividade" },
  { valor: "situacao_agendamento", label: "Situação do agendamento", categoria: "Atividade" },
  { valor: "dia_semana", label: "Dia da semana", categoria: "Atividade" },
  { valor: "horario", label: "Horário", categoria: "Atividade" },
];

const CATEGORIAS_ORDEM: CategoriaCampo[] = ["Conversa", "Funil / Negócio", "Contato", "Atividade"];

const CAMPOS_SIM_NAO = new Set<CampoCondicao>(["respondeu", "recebeu_automacao", "em_outra_automacao", "possui_agendamento", "consentimento"]);
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CANAIS = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "email", label: "E-mail" },
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

  const { funis } = useFunis();
  const equipes = useEquipesDisponiveis();
  const etapas = Array.from(new Set(funis.flatMap((f) => f.colunas.map((c) => c.titulo))));
  const { estado } = useConfiguracoes();
  const etiquetas = useMemo(() => {
    const nomes = new Set<string>();
    contatos.forEach((c) => c.etiquetas?.forEach((e) => nomes.add(e)));
    funis.forEach((f) => f.colunas.forEach((col) => col.cards.forEach((card) => card.etiquetas?.forEach((e) => nomes.add(e)))));
    estado.etiquetasPersonalizadas.forEach((e) => nomes.add(e.nome));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funis, estado.etiquetasPersonalizadas]);

  function renderValorInput(regra: RegraCondicao) {
    const onChangeValor = (valor: string) => atualizarRegra(regra.id, { valor });

    if (CAMPOS_SIM_NAO.has(regra.campo)) {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      );
    }
    if (regra.campo === "canal") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {CANAIS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "etiqueta") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {etiquetas.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "funil") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {funis.map((f) => (
            <option key={f.id} value={f.nome}>
              {f.nome}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "etapa") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {etapas.map((titulo) => (
            <option key={titulo} value={titulo}>
              {titulo}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "responsavel") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {equipe.map((m) => (
            <option key={m.nome} value={m.nome}>
              {m.nome}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "equipe") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {equipes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "dia_semana") {
      return (
        <select className="input" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor">
          <option value="">Selecione…</option>
          {DIAS_SEMANA.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      );
    }
    if (regra.campo === "horario" || regra.campo === "horario_ultima_mensagem") {
      return <input className="input" type="time" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor" />;
    }
    if (regra.campo === "data_ultima_conversa") {
      return <input className="input" type="date" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor" />;
    }
    return <input className="input" placeholder="Valor" value={regra.valor ?? ""} onChange={(e) => onChangeValor(e.target.value)} aria-label="Valor" />;
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
            {CATEGORIAS_ORDEM.map((cat) => (
              <optgroup key={cat} label={cat}>
                {CAMPOS.filter((c) => c.categoria === cat).map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
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
          {regra.operador !== "existe" && regra.operador !== "nao_existe" ? renderValorInput(regra) : null}
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
