"use client";

import { useState } from "react";

import { contatos, filtrosContatos, localizarNoFunil } from "@/lib/data";
import { IconSearch } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";

export default function ContatosPage() {
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const contato = contatos.find((c) => c.nome === selecionado) ?? null;
  const noFunil = contato ? localizarNoFunil(contato.nome) : null;

  return (
    <>
      <Topbar
        title="Contatos"
        sub="247 contatos · visão 360° de cada lead"
        actions={
          <>
            <label className="search">
              <IconSearch />
              <input placeholder="Buscar contato…" aria-label="Buscar contato" />
            </label>
            <button type="button" className="btn primary">
              + Novo contato
            </button>
          </>
        }
      />

      <div className="content">
        <ChipFilters options={filtrosContatos} />

        <div className="card mb14">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Origem</th>
                  <th>Etapa</th>
                  <th>Responsável</th>
                  <th>Última interação</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <button
                        type="button"
                        className="name-cell"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setSelecionado((atual) =>
                            atual === c.nome ? null : c.nome,
                          )
                        }
                      >
                        <div className="avatar">{c.initials}</div>
                        <span
                          className="n"
                          style={{
                            color:
                              selecionado === c.nome ? "var(--blue)" : undefined,
                          }}
                        >
                          {c.nome}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="origin-tag">{c.origem}</span>
                    </td>
                    <td>
                      <span
                        className={`stage-tag${
                          c.etapa === "Fechado" ? " won" : ""
                        }`}
                      >
                        {c.etapa}
                      </span>
                    </td>
                    <td>{c.responsavel}</td>
                    <td>{c.ultima}</td>
                    <td>{c.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {contato ? (
          <section className="open-conv">
            <div className="open-conv-h">
              <div className="avatar">{contato.initials}</div>
              <div>
                <p className="n">{contato.nome}</p>
                <p className="s">
                  {contato.origem} · última interação {contato.ultima.toLowerCase()}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setSelecionado(null)}
              >
                Fechar ✕
              </span>
            </div>

            <div className="field">
              <label>Funil</label>
              <div className="input">
                {noFunil ? noFunil.funil : "Ainda não entrou em nenhum funil"}
              </div>
            </div>
            <div className="field">
              <label>Etapa no funil</label>
              <div className="input">{noFunil ? noFunil.etapa : "—"}</div>
            </div>
            <div className="field">
              <label>Origem</label>
              <div className="input">{contato.origem}</div>
            </div>
            <div className="field">
              <label>Responsável</label>
              <div className="input">{contato.responsavel}</div>
            </div>
            <div className="field">
              <label>Valor</label>
              <div className="input">{contato.valor}</div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
