"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import type { PainelSocial } from "@/app/api/social/metricas/route";

/**
 * Painel do módulo Social.
 *
 * A regra desta tela é a mais simples e a mais fácil de quebrar: **só número que existe**. Nada de
 * alcance estimado, engajamento calculado por cima ou gráfico preenchido com o que seria bonito
 * ter. E os dois blocos ficam separados de propósito, porque têm confiabilidade diferente: o que o
 * CRM registrou é exato e sempre está lá; o que o Instagram informa depende de permissão, de tipo
 * de conta e da API estar de pé. Somar os dois num número só produziria um painel bonito e
 * mentiroso.
 */
const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

function Numero({ valor, label, ajuda }: { valor: number; label: string; ajuda?: string }) {
  return (
    <div className="social-numero">
      <strong>{valor.toLocaleString("pt-BR")}</strong>
      <span>{label}</span>
      {ajuda ? <em>{ajuda}</em> : null}
    </div>
  );
}

export default function SocialPage() {
  const { fluxos } = useAutomationFlows();
  const [dias, setDias] = useState(7);
  // O período pedido viaja JUNTO com a resposta. Assim "carregando" é derivado (a resposta que
  // tenho não é do período que estou mostrando) em vez de ser um segundo estado que precisa ser
  // ligado e desligado na mão, e que erra sozinho quando duas buscas se cruzam.
  const [resposta, setResposta] = useState<{ paraDias: number; dados: PainelSocial | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/social/metricas?dias=${dias}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PainelSocial>) : null))
      .then((dados) => {
        if (!cancelado) setResposta({ paraDias: dias, dados });
      })
      .catch(() => {
        if (!cancelado) setResposta({ paraDias: dias, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [dias]);

  const carregando = resposta?.paraDias !== dias;
  const painel = resposta?.dados ?? null;

  const robos = useMemo(() => fluxos.filter((f) => f.area === "social" && !f.arquivada), [fluxos]);
  const ligados = robos.filter((f) => f.status === "publicado" && f.ativa);

  return (
    <>
      <Topbar
        title="Social"
        sub="Instagram: o que chegou, o que os robôs fizeram e o que a Meta informa"
        actions={
          <div className="social-periodo">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                type="button"
                className={`seg-chip${dias === p.dias ? " on" : ""}`}
                onClick={() => setDias(p.dias)}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      <AbasSocial />

      <div className="content">
        {painel && !painel.conectado ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <strong>O Instagram não está conectado.</strong>
            <p className="hint mt8">
              {painel.motivoDesconectado} Os números do CRM abaixo continuam valendo pro que já foi
              registrado.
            </p>
            <Link className="btn primary mt8" href="/social/conexoes">
              Ver conexões
            </Link>
          </section>
        ) : null}

        <section className="card">
          <h3>O que o CRM registrou</h3>
          <p className="hint">
            Contado neste banco, nos últimos {painel?.periodoDias ?? dias} dias. É exato: cada
            número aqui é uma linha que existe.
          </p>
          {carregando && !painel ? (
            <p className="hint mt8">Carregando…</p>
          ) : painel ? (
            <div className="social-numeros mt8">
              <Numero valor={painel.crm.directs} label="Mensagens no Direct" />
              <Numero valor={painel.crm.comentarios} label="Comentários" />
              <Numero valor={painel.crm.storiesRespondidos} label="Respostas a story" />
              <Numero valor={painel.crm.mencoes} label="Menções em story" />
              <Numero valor={painel.crm.reacoes} label="Reações recebidas" />
              <Numero valor={painel.crm.leadsCriados} label="Leads criados pelo Instagram" />
              <Numero valor={painel.crm.automacoesIniciadas} label="Automações sociais iniciadas" />
            </div>
          ) : (
            <p className="hint mt8">Não deu pra carregar agora.</p>
          )}
        </section>

        {painel?.conectado ? (
          <section className="card mt16">
            <h3>O que o Instagram informa</h3>
            <p className="hint">
              Vem da API da Meta. Depende do tipo da conta e das permissões concedidas, então pode
              faltar item: o que ela recusa aparece abaixo, com o motivo dela.
            </p>

            {painel.instagram?.perfil ? (
              <div className="social-numeros mt8">
                {typeof painel.instagram.perfil.seguidores === "number" ? (
                  <Numero valor={painel.instagram.perfil.seguidores} label="Seguidores" />
                ) : null}
                {typeof painel.instagram.perfil.publicacoes === "number" ? (
                  <Numero valor={painel.instagram.perfil.publicacoes} label="Publicações" />
                ) : null}
                {painel.instagram.metricas.map((m) => (
                  <Numero key={m.chave} valor={m.valor} label={m.label} ajuda={m.ajuda} />
                ))}
              </div>
            ) : null}

            {painel.instagram?.perfilErro ? (
              <p className="hint mt8">Perfil: {painel.instagram.perfilErro}</p>
            ) : null}

            {painel.instagram?.recusadas.length ? (
              <div className="mt8">
                <p className="hint">Não disponíveis nesta conta:</p>
                <ul className="hint">
                  {painel.instagram.recusadas.map((r) => (
                    <li key={r.chave}>
                      <strong>{r.label}</strong>: {r.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!painel.instagram ? <p className="hint mt8">Não deu pra falar com a Meta agora.</p> : null}
          </section>
        ) : null}

        <section className="card mt16">
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
