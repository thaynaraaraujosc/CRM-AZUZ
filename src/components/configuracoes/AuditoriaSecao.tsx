"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useEquipe } from "@/lib/equipe-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type Registro = { id: string; data: string; usuario: string; acao: string; modulo: string; item: string; dispositivo: string; detalhes: string };

const REGISTROS_MOCK: Registro[] = [
  { id: "a1", data: "30/07 14:12", usuario: "Ana Ferreira", acao: "Editou", modulo: "Automações", item: "Boas-vindas pro lead novo", dispositivo: "Chrome · Windows", detalhes: "Alterou o texto da mensagem de boas-vindas." },
  { id: "a2", data: "30/07 11:03", usuario: "Bruno Salles", acao: "Moveu negócio", modulo: "Funil", item: "Julia Prado", dispositivo: "App · iPhone", detalhes: 'Moveu de "Qualificado" pra "Proposta".' },
  { id: "a3", data: "29/07 18:40", usuario: "Ana Ferreira", acao: "Criou", modulo: "Usuários", item: "Convite — Carla Mendes", dispositivo: "Chrome · Windows", detalhes: "Convite enviado com função Vendedor." },
  { id: "a4", data: "29/07 09:22", usuario: "Dr. Hélio Marinho", acao: "Excluiu", modulo: "Tarefas", item: "Ligar pra confirmar retorno", dispositivo: "Chrome · Windows", detalhes: "Tarefa marcada como concluída e removida." },
];

const MODULOS = ["Todos", "Automações", "Funil", "Usuários", "Tarefas"];

/** Auditoria e atividades (item 38) — histórico mockado, com filtros e detalhe por linha. */
export function AuditoriaSecao() {
  const { membros: equipe } = useEquipe();
  const [usuarioFiltro, setUsuarioFiltro] = useState("Todos");
  const [moduloFiltro, setModuloFiltro] = useState("Todos");
  const [detalheAberto, setDetalheAberto] = useState<Registro | null>(null);

  const registros = REGISTROS_MOCK.filter(
    (r) => (usuarioFiltro === "Todos" || r.usuario === usuarioFiltro) && (moduloFiltro === "Todos" || r.modulo === moduloFiltro),
  );

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Auditoria e atividades" descricao="Histórico do que aconteceu neste workspace." />

      <div className="config-bloco">
        <div className="config-grid-2" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Usuário</label>
            <select className="input" value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)}>
              <option>Todos</option>
              {equipe.map((m) => (
                <option key={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Módulo</label>
            <select className="input" value={moduloFiltro} onChange={(e) => setModuloFiltro(e.target.value)}>
              {MODULOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Módulo</th>
                <th>Item</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="config-linha-clicavel-tr" onClick={() => setDetalheAberto(r)} style={{ cursor: "pointer" }}>
                  <td>{r.data}</td>
                  <td>{r.usuario}</td>
                  <td>{r.acao}</td>
                  <td>{r.modulo}</td>
                  <td>{r.item}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        aberto={!!detalheAberto}
        onFechar={() => setDetalheAberto(null)}
        titulo={detalheAberto ? `${detalheAberto.acao} · ${detalheAberto.item}` : ""}
        largura={440}
      >
        {detalheAberto ? (
          <>
            <p className="hint">
              {detalheAberto.usuario} · {detalheAberto.data} · {detalheAberto.dispositivo}
            </p>
            <p style={{ marginTop: 10 }}>{detalheAberto.detalhes}</p>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
