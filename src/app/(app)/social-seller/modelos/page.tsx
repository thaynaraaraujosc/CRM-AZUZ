"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { AbasSocial } from "@/components/social/AbasSocial";
import { MODELOS_AZUZ, type ModeloAzuz } from "@/lib/social/modelos-azuz";
import { LIMITES } from "@/lib/templates/regras";
import { useIdioma } from "@/lib/idioma-context";

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
  const { t: traduzir } = useIdioma();
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
      avisar(erro instanceof Error ? erro.message : traduzir("Não deu certo."));
    } finally {
      setCopiando(null);
    }
  }

  return (
    <>
      <AcoesNoTopo>
        <Link className="btn primary" href="/automacoes/templates">
          {traduzir("Abrir editor de templates")}
        </Link>
      </AcoesNoTopo>

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
        {aviso ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <p className="hint">{aviso}</p>
          </section>
        ) : null}

        {/*
          OS MODELOS DA AZUZ COMO CARTÕES, com a mensagem numa bolha.
          
          Eram parágrafos soltos dentro de um cartão só, e a mensagem — que é o conteúdo — tinha o
          mesmo peso do "quando usar" e do nome. Na bolha ela aparece como o contato vai ver no
          Direct, que é a única forma de julgar um modelo sem copiá-lo antes.
        */}
        <section className="ssl-secao">
          <div className="social-secao-topo">
            <h3>
              {traduzir("Modelos AZUZ")} <span className="social-contador">{MODELOS_AZUZ.length}</span>
            </h3>
          </div>
          <p className="mod-nota">
            {traduzir("Copiar cria um modelo SEU, que você edita antes de usar.")} {LIMITES.instagram.explicacao}
          </p>
          <div className="mod-grade">
            {MODELOS_AZUZ.map((m) => (
              <article key={m.id} className="mod-cartao">
                <strong>{m.nome}</strong>
                <span className="mod-quando">{m.quando}</span>
                <p className="flow-bolha">{m.corpo}</p>
                {m.botoes?.length ? (
                  <span className="mod-botoes">
                    {m.botoes.map((b) => (
                      <span key={b.texto} className="mod-botao">
                        {b.texto}
                      </span>
                    ))}
                  </span>
                ) : null}
                <button type="button" className="btn ss-primario mod-copiar" disabled={copiando === m.id} onClick={() => copiar(m)}>
                  {copiando === m.id ? traduzir("Copiando…") : traduzir("Copiar pros meus")}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="ssl-secao">
          <div className="social-secao-topo">
            <h3>
              {traduzir("Meus modelos")}{" "}
              <span className="social-contador">{meus?.length ?? 0}</span>
            </h3>
            <Link className="btn ghost pequeno" href="/automacoes/templates">
              {traduzir("Editor de templates")}
            </Link>
          </div>
          {meus === null ? (
            <p className="hint">{traduzir("Carregando…")}</p>
          ) : !meus.length ? (
            <p className="fflow-vazio">
              {traduzir("Nenhum ainda. Copie um da AZUZ acima, ou crie do zero no editor de templates.")}
            </p>
          ) : (
            /* A mesma linha-cartão da lista de automações: é a mesma pergunta — "qual deles?" —
               e duas formas diferentes pro mesmo tipo de lista é o que faz um módulo parecer
               montado por duas pessoas. */
            <ul className="ssl-lista">
              {meus.map((t) => (
                <li key={t.id} className="ssl-item mod-item">
                  <span className="ssl-nome">
                    <strong>{t.nome}</strong>
                  </span>
                  <span className="mod-previa">
                    {t.corpo.slice(0, 180)}
                    {t.corpo.length > 180 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
