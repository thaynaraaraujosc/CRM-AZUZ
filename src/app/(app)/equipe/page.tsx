import Link from "next/link";
import type { Metadata } from "next";

import { equipe } from "@/lib/data";
import { Toggle, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Equipe · CRM AZUZ" };

export default function EquipePage() {
  return (
    <>
      <Topbar
        title="Equipe"
        sub={`${equipe.length} pessoas · controle de acesso por papel`}
        actions={
          <Link className="btn primary" href="/equipe/convidar">
            + Convidar
          </Link>
        }
      />

      <div className="content">
        <div className="card">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Papel</th>
                  <th>Leads atribuídos</th>
                  <th>O que enxerga</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((membro) => (
                  <tr key={membro.nome}>
                    <td>
                      <div className="name-cell">
                        <div className="avatar">{membro.initials}</div>
                        <span className="n">{membro.nome}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`role-tag ${membro.papelTipo}`}>
                        {membro.papel}
                        {membro.papelNota ? (
                          <span className="soft"> {membro.papelNota}</span>
                        ) : null}
                      </span>
                    </td>
                    <td>{membro.leads}</td>
                    <td>
                      <span className="access-note">{membro.enxerga}</span>
                    </td>
                    <td>
                      {membro.convitePendente ? (
                        <span className="pill">Convite pendente</span>
                      ) : (
                        <Toggle
                          defaultOn={membro.ativo}
                          label={`Ativar ${membro.nome}`}
                        />
                      )}
                    </td>
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
