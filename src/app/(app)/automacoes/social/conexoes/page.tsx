"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useFunis } from "@/lib/funis-context";
import type { ConexaoSocial } from "@/app/api/social/conexoes/route";
import type { DestinoLeadSocial } from "@/lib/social/destino-lead";

/**
 * Conexões da área social, e o que acontece com quem chega por elas.
 *
 * O canal sem integração aparece aqui de propósito, apagado e com o motivo escrito. Escondê-lo
 * deixaria a pergunta "cadê o TikTok?" sem resposta em lugar nenhum do produto; oferecê-lo com um
 * botão que não faz nada seria pior ainda.
 */
export default function ConexoesSociaisPage() {
  const { funis } = useFunis();
  const [conexoes, setConexoes] = useState<ConexaoSocial[] | null>(null);
  const [destino, setDestino] = useState<DestinoLeadSocial | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/social/conexoes", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social/destino-lead", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([c, d]) => {
        setConexoes(Array.isArray(c) ? (c as ConexaoSocial[]) : []);
        setDestino((d as DestinoLeadSocial | null) ?? { funilId: null, etapaId: null });
      })
      .catch(() => {
        setConexoes([]);
        setDestino({ funilId: null, etapaId: null });
      });
  }, []);

  const funilEscolhido = useMemo(
    () => funis.find((f) => f.id === destino?.funilId) ?? null,
    [funis, destino?.funilId],
  );

  async function salvar(novo: DestinoLeadSocial) {
    setDestino(novo);
    setSalvando(true);
    try {
      const r = await fetch("/api/social/destino-lead", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(novo),
      });
      if (!r.ok) throw new Error("Não deu pra salvar.");
      setAviso("Salvo.");
    } catch {
      setAviso("Não deu pra salvar. Tente de novo.");
    } finally {
      setSalvando(false);
      setTimeout(() => setAviso(null), 3000);
    }
  }

  return (
    <>
      <Topbar title="Conexões" sub="O que está ligado, e onde caem os leads que chegam por aqui" />
      <AbasAutomacoes />

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
        <section className="card">
          <h3>Canais</h3>
          <div className="social-conexoes mt8">
            {(conexoes ?? []).map((c) => (
              <div key={c.canal} className={`social-conexao${c.disponivel ? "" : " indisponivel"}`}>
                <h4>{c.label}</h4>
                <p className="hint">{c.resumo}</p>
                <p className="mt8">
                  <span className={`badge ${c.conectado ? "badge-success" : "badge-neutral"}`}>
                    {!c.disponivel ? "Sem integração" : c.conectado ? "Conectado" : "Desconectado"}
                  </span>
                  {c.detalhe ? <span className="hint" style={{ marginLeft: 8 }}>{c.detalhe}</span> : null}
                </p>
                {c.motivo ? <p className="hint mt8">{c.motivo}</p> : null}
                {c.disponivel && !c.conectado ? (
                  <Link className="btn mt8" href="/configuracoes">
                    Ir para Configurações
                  </Link>
                ) : null}
              </div>
            ))}
            {conexoes && !conexoes.length ? <p className="hint">Carregando…</p> : null}
          </div>
        </section>

        <section className="card mt16">
          <h3>Onde cai o lead que chega pelo Instagram</h3>
          <p className="hint">
            Por padrão vai pro primeiro funil, primeira etapa, junto com todo mundo. Quem responde um
            story não está no mesmo momento de quem pediu orçamento, então costuma valer a pena
            separar. Ligar ou desligar a criação de lead continua sendo na própria conexão, em
            Configurações.
          </p>

          <div className="field mt8" style={{ maxWidth: 340 }}>
            <label>Funil</label>
            <select
              className="input"
              value={destino?.funilId ?? ""}
              onChange={(e) => salvar({ funilId: e.target.value || null, etapaId: null })}
              disabled={salvando}
            >
              <option value="">Primeiro funil do workspace</option>
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          {funilEscolhido ? (
            <div className="field" style={{ maxWidth: 340 }}>
              <label>Etapa</label>
              <select
                className="input"
                value={destino?.etapaId ?? ""}
                onChange={(e) => salvar({ funilId: destino?.funilId ?? null, etapaId: e.target.value || null })}
                disabled={salvando}
              >
                <option value="">Primeira etapa do funil</option>
                {funilEscolhido.colunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {aviso ? <p className="hint">{aviso}</p> : null}
        </section>
        </div>
      </div>
    </>
  );
}
