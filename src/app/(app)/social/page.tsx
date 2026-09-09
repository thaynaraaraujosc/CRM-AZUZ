"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import type { ConexaoSocial } from "@/app/api/social/conexoes/route";

/**
 * Painel do módulo Social.
 *
 * A regra desta tela é a mais simples e a mais fácil de quebrar: **só número que existe**. Nada de
 * alcance estimado, engajamento inventado ou gráfico bonito preenchido com o que seria legal ter.
 * Cada bloco daqui vem de uma consulta ao que o CRM realmente gravou, ou da própria API do
 * Instagram. O que a API não entrega, esta tela não mostra.
 */
export default function SocialPage() {
  const { fluxos } = useAutomationFlows();
  const [conexoes, setConexoes] = useState<ConexaoSocial[] | null>(null);

  useEffect(() => {
    fetch("/api/social/conexoes", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ConexaoSocial[]>) : null))
      .then((dados) => setConexoes(Array.isArray(dados) ? dados : []))
      .catch(() => setConexoes([]));
  }, []);

  const robos = useMemo(() => fluxos.filter((f) => f.area === "social" && !f.arquivada), [fluxos]);
  const ligados = robos.filter((f) => f.status === "publicado" && f.ativa);
  const instagram = conexoes?.find((c) => c.canal === "instagram");

  return (
    <>
      <Topbar title="Social" sub="Instagram: automações, respostas e alcance do que o CRM registrou" />
      <AbasSocial />

      <div className="content">
        {instagram && !instagram.conectado ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <strong>Conecte o Instagram pra este painel ter o que mostrar.</strong>
            <p className="hint mt8">{instagram.motivo}</p>
            <Link className="btn primary mt8" href="/social/conexoes">
              Ver conexões
            </Link>
          </section>
        ) : null}

        <section className="card">
          <h3>Seus robôs do Instagram</h3>
          <p className="hint">
            {robos.length
              ? `${robos.length} robô${robos.length > 1 ? "s" : ""}, ${ligados.length} ligado${ligados.length === 1 ? "" : "s"}.`
              : "Nenhum robô ainda."}
          </p>
          <Link className="btn mt8" href="/social/automacoes">
            Abrir automações
          </Link>
        </section>
      </div>
    </>
  );
}
