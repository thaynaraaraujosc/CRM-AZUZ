"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const CANAIS_EQUIPE = ["WhatsApp", "Instagram", "E-mail"];
const METODOS_DISTRIBUICAO = [
  { valor: "manual", label: "Manual" },
  { valor: "rodizio", label: "Rodízio" },
  { valor: "disponibilidade", label: "Por disponibilidade" },
  { valor: "menor_quantidade", label: "Menor quantidade de leads" },
  { valor: "prioridade", label: "Prioridade definida" },
];

/** Equipes (item 23) — CRUD local (`configuracoes-context`); membros/gestor reaproveitam a lista real
 * de `equipe` (data.ts) pra popular os seletores. */
export function EquipesSecao() {
  const { estado, adicionarEquipe, removerEquipe } = useConfiguracoes();
  const { membros: equipe } = useEquipe();
  const { funis } = useFunis();
  const [aberta, setAberta] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gestor, setGestor] = useState(equipe[0]?.nome ?? "");
  const [metodo, setMetodo] = useState(METODOS_DISTRIBUICAO[0].valor);

  const equipeAberta = estado.equipesPersonalizadas.find((e) => e.id === aberta);

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Equipes"
        descricao="Grupos de atendimento, distribuição de leads e metas."
        acoes={
          <button type="button" className="btn primary" onClick={() => setNovaAberta(true)}>
            + Nova equipe
          </button>
        }
      />

      {estado.equipesPersonalizadas.length === 0 ? (
        <div className="config-bloco" style={{ textAlign: "center" }}>
          <p className="hint">Nenhuma equipe criada ainda — comece com &quot;Atendimento&quot;, &quot;Comercial&quot; ou &quot;Marketing&quot;, por exemplo.</p>
        </div>
      ) : (
        <div className="config-bloco">
          <div className="config-lista-linhas">
            {estado.equipesPersonalizadas.map((e) => (
              <button type="button" key={e.id} className={`config-linha-clicavel${aberta === e.id ? " active" : ""}`} onClick={() => setAberta(e.id)}>
                <span className="config-etiqueta-cor" style={{ background: e.cor }} />
                <div>
                  <p className="n">{e.nome}</p>
                  <p className="r">
                    {e.descricao} · gestor: {e.gestor}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {equipeAberta ? (
        <div className="config-bloco">
          <CabecalhoCategoria
            titulo={equipeAberta.nome}
            descricao={equipeAberta.descricao}
            acoes={
              <button type="button" className="btn danger" onClick={() => { removerEquipe(equipeAberta.id); setAberta(null); }}>
                Excluir equipe
              </button>
            }
          />
          <div className="config-grid-2">
            <div className="field">
              <label>Gestor responsável</label>
              <p className="r">{equipeAberta.gestor}</p>
            </div>
            <div className="field">
              <label>Método de distribuição</label>
              <p className="r">{METODOS_DISTRIBUICAO.find((m) => m.valor === equipeAberta.metodoDistribuicao)?.label}</p>
            </div>
            <div className="field">
              <label>Membros</label>
              <p className="r">{equipe.map((m) => m.nome).join(", ")}</p>
            </div>
            <div className="field">
              <label>Funis associados</label>
              <p className="r">{funis.map((f) => f.nome).join(", ")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        aberto={novaAberta}
        onFechar={() => setNovaAberta(false)}
        titulo="Nova equipe"
        largura={460}
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setNovaAberta(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!nome.trim()}
              onClick={() => {
                adicionarEquipe({ nome, descricao, gestor, cor: "#2e6bff", metodoDistribuicao: metodo });
                setNome("");
                setDescricao("");
                setNovaAberta(false);
              }}
            >
              Criar equipe
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label>Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atendimento" />
          </div>
          <div className="field">
            <label>Descrição</label>
            <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="field">
            <label>Gestor</label>
            <select className="input" value={gestor} onChange={(e) => setGestor(e.target.value)}>
              {equipe.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Método de distribuição</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {METODOS_DISTRIBUICAO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">Canais permitidos: {CANAIS_EQUIPE.join(", ")} (todos, nesta fase).</p>
        </div>
      </Modal>
    </div>
  );
}
