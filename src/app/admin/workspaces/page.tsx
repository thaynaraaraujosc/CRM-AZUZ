"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Ajuda, Topbar } from "@/components/ui";
import { PLANOS, type PlanoId } from "@/lib/assinatura/planos";
import { CriarContaCortesia } from "@/components/admin/CriarContaCortesia";
import { ApagarEmpresa } from "@/components/admin/ApagarEmpresa";

type WorkspaceLinha = {
  id: string;
  nome: string;
  slug: string;
  criadoEm: string;
  _count: { membros: number };
  assinatura: {
    plano: string;
    status: string;
    valor: string;
    cortesiaAte: string | null;
    ehCortesia: boolean;
    diasDeCortesia: number | null;
  } | null;
};

const NOME_STATUS: Record<string, string> = {
  pendente: "Pendente",
  ativa: "Ativo",
  atrasada: "Atrasado",
  cancelada: "Cancelado",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Todas as empresas da plataforma: quem usa, em que plano, pagando ou de cortesia — e o botão de
 * apagar, que é o que permite a base parar de misturar cliente com conta de teste.
 */
export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceLinha[] | null>(null);
  // Muda quando uma conta é criada ou apagada: é o que faz a lista se atualizar sozinha.
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    fetch("/api/admin/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces);
  }, [versao]);

  const pagando = workspaces?.filter((w) => w.assinatura && !w.assinatura.ehCortesia && w.assinatura.status === "ativa").length ?? 0;

  return (
    <div className="view">
      <Topbar
        title="Empresas"
        sub={workspaces ? `${workspaces.length} cadastradas · ${pagando} pagando` : undefined}
      />

      <CriarContaCortesia aoCriar={() => setVersao((v) => v + 1)} />

      <div className="config-tabela-scroll">
        <table className="config-tabela-notif admin-tabela">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Usuários</th>
              <th>Plano</th>
              <th>
                Situação
                <Ajuda texto="Ativo é quem pode usar o CRM. “Cortesia” usa de graça até a data marcada; depois dela a conta cai na tela de pagamento sozinha." />
              </th>
              <th>Criada em</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {!workspaces ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-muted)" }}>Carregando…</td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-muted)" }}>Nenhuma empresa ainda.</td>
              </tr>
            ) : (
              workspaces.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/admin/workspaces/${w.id}`} style={{ fontWeight: 600 }}>
                      {w.nome}
                    </Link>
                  </td>
                  <td>{w._count.membros}</td>
                  <td>{w.assinatura ? PLANOS[w.assinatura.plano as PlanoId]?.nome ?? w.assinatura.plano : "—"}</td>
                  <td>
                    {!w.assinatura ? (
                      <span className="pill">Sem assinatura</span>
                    ) : (
                      <span className="admin-situacao">
                        <span className={`pill${w.assinatura.status === "ativa" ? " on" : ""}`}>
                          {NOME_STATUS[w.assinatura.status] ?? w.assinatura.status}
                        </span>
                        {/* A cortesia é dita ao lado do status, não no lugar dele: as duas coisas
                            são verdadeiras ao mesmo tempo e respondem perguntas diferentes —
                            "consegue entrar?" e "está pagando?". */}
                        {w.assinatura.cortesiaAte ? (
                          <em className="admin-cortesia">
                            cortesia até {formatarData(w.assinatura.cortesiaAte)}
                            {w.assinatura.diasDeCortesia !== null && w.assinatura.diasDeCortesia >= 0
                              ? ` (${w.assinatura.diasDeCortesia}d)`
                              : " (vencida)"}
                          </em>
                        ) : w.assinatura.ehCortesia ? (
                          <em className="admin-cortesia">sem cobrança</em>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td>{formatarData(w.criadoEm)}</td>
                  <td style={{ textAlign: "right" }}>
                    <ApagarEmpresa
                      id={w.id}
                      nome={w.nome}
                      membros={w._count.membros}
                      aoApagar={() => setVersao((v) => v + 1)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
