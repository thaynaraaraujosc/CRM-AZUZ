import type { Metadata } from "next";

import { contatos, filtrosContatos } from "@/lib/data";
import { IconSearch } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Contatos · CRM AZUZ" };

export default function ContatosPage() {
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

        <div className="card">
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
                {contatos.map((contato) => (
                  <tr key={contato.nome}>
                    <td>
                      <div className="name-cell">
                        <div className="avatar">{contato.initials}</div>
                        <span className="n">{contato.nome}</span>
                      </div>
                    </td>
                    <td>
                      <span className="origin-tag">{contato.origem}</span>
                    </td>
                    <td>
                      <span
                        className={`stage-tag${
                          contato.etapa === "Fechado" ? " won" : ""
                        }`}
                      >
                        {contato.etapa}
                      </span>
                    </td>
                    <td>{contato.responsavel}</td>
                    <td>{contato.ultima}</td>
                    <td>{contato.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
