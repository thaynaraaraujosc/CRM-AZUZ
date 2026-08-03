"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useConfiguracoes } from "@/lib/configuracoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const OBJETOS = ["Contatos", "Negócios", "Empresas", "Tarefas", "Agendamentos"];
const TIPOS = [
  "texto curto",
  "texto longo",
  "número",
  "moeda",
  "porcentagem",
  "telefone",
  "e-mail",
  "data",
  "data e hora",
  "seleção única",
  "múltipla seleção",
  "sim ou não",
  "URL",
  "endereço",
  "responsável",
  "arquivo",
];

/** Campos personalizados (item 25). */
export function CamposSecao() {
  const { estado, adicionarCampo, removerCampo } = useConfiguracoes();
  const [filtroObjeto, setFiltroObjeto] = useState("Todos");
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [objeto, setObjeto] = useState(OBJETOS[0]);
  const [obrigatorio, setObrigatorio] = useState(false);

  const campos = estado.camposPersonalizados.filter((c) => filtroObjeto === "Todos" || c.objeto === filtroObjeto);

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Campos personalizados"
        descricao="Campos extras em contatos, negócios e outros objetos do CRM."
        acoes={
          <button type="button" className="btn primary" onClick={() => setNovoAberto(true)}>
            + Novo campo
          </button>
        }
      />

      <div className="filters-row mb14">
        {["Todos", ...OBJETOS].map((o) => (
          <button type="button" key={o} className={`fchip${filtroObjeto === o ? " active" : ""}`} onClick={() => setFiltroObjeto(o)}>
            {o}
          </button>
        ))}
      </div>

      {campos.length === 0 ? (
        <div className="config-bloco" style={{ textAlign: "center" }}>
          <p className="hint">Nenhum campo personalizado ainda nesse objeto.</p>
        </div>
      ) : (
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Objeto</th>
                <th>Obrigatório</th>
                <th>Visível</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.tipo}</td>
                  <td>{c.objeto}</td>
                  <td>{c.obrigatorio ? "Sim" : "Não"}</td>
                  <td>{c.visivel ? "Sim" : "Não"}</td>
                  <td>
                    <button type="button" className="remove-chip" aria-label={`Remover ${c.nome}`} onClick={() => removerCampo(c.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        titulo="Novo campo personalizado"
        largura={440}
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setNovoAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!nome.trim()}
              onClick={() => {
                adicionarCampo({ nome, tipo, objeto, obrigatorio, visivel: true });
                setNome("");
                setNovoAberto(false);
              }}
            >
              Criar campo
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label>Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Objeto</label>
            <select className="input" value={objeto} onChange={(e) => setObjeto(e.target.value)}>
              {OBJETOS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
        </div>
      </Modal>
    </div>
  );
}
