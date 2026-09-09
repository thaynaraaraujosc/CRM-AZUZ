"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import { MODELOS_AZUZ, type ModeloAzuz } from "@/lib/social/modelos-azuz";
import { LIMITES } from "@/lib/templates/regras";

type TemplateSalvo = {
  id: string;
  nome: string;
  canal: string;
  corpo: string;
  botoes?: { texto: string }[] | null;
};

/**
 * Modelos de mensagem do Instagram.
 *
 * Duas listas, separadas de propósito: os modelos escritos pela AZUZ e os do próprio workspace.
 * Misturar faria alguém mandar pro cliente dele um texto que nunca leu, achando que era seu. O da
 * AZUZ não é usado direto: ele vira uma CÓPIA sua, que você edita antes de usar.
 *
 * Não é um segundo sistema de templates. É a mesma tabela e a mesma API de Templates, filtrada
 * pelo canal, com o editor completo a um clique de distância.
 */
export default function ModelosSociaisPage() {
  const [meus, setMeus] = useState<TemplateSalvo[] | null>(null);
  const [copiando, setCopiando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const r = await fetch("/api/templates", { cache: "no-store" });
    const todos = r.ok ? ((await r.json()) as TemplateSalvo[]) : [];
    setMeus(Array.isArray(todos) ? todos.filter((t) => t.canal === "instagram") : []);
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(recarregar)
      .catch(() => setMeus([]));
  }, [recarregar]);

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 4000);
  }

  async function copiar(modelo: ModeloAzuz) {
    setCopiando(modelo.id);
    try {
      const resposta = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: modelo.nome,
          canal: "instagram",
          corpo: modelo.corpo,
          botoes: modelo.botoes ?? [],
        }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu certo.");
      avisar("Copiado pros seus modelos. Edite antes de usar.");
      await recarregar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não deu certo.");
    } finally {
      setCopiando(null);
    }
  }

  return (
    <>
      <Topbar
        title="Modelos do Instagram"
        sub="Mensagens reutilizáveis do Direct"
        actions={
          <Link className="btn primary" href="/automacoes/templates">
            Abrir editor de templates
          </Link>
        }
      />
      <AbasAutomacoes />

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
        {aviso ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <p className="hint">{aviso}</p>
          </section>
        ) : null}

        <section className="card">
          <h3>Modelos AZUZ</h3>
          <p className="hint">
            Escritos aqui, prontos pra copiar. Copiar cria um modelo SEU, que você edita antes de
            usar. {LIMITES.instagram.explicacao}
          </p>
          <div className="social-modelos">
            {MODELOS_AZUZ.map((m) => (
              <div key={m.id} className="social-modelo" style={{ cursor: "default" }}>
                <strong>{m.nome}</strong>
                <em>{m.quando}</em>
                <span style={{ whiteSpace: "pre-wrap" }}>{m.corpo}</span>
                {m.botoes?.length ? (
                  <span>
                    Respostas rápidas: {m.botoes.map((b) => b.texto).join(" · ")}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="btn mt8"
                  disabled={copiando === m.id}
                  onClick={() => copiar(m)}
                >
                  {copiando === m.id ? "Copiando…" : "Copiar pros meus"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt16">
          <h3>Meus modelos</h3>
          {meus === null ? (
            <p className="hint">Carregando…</p>
          ) : !meus.length ? (
            <p className="hint">
              Nenhum ainda. Copie um da AZUZ acima, ou crie do zero no editor de templates.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {meus.map((t) => (
                  <tr key={t.id}>
                    <td>{t.nome}</td>
                    <td className="hint" style={{ whiteSpace: "pre-wrap" }}>
                      {t.corpo.slice(0, 180)}
                      {t.corpo.length > 180 ? "…" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
