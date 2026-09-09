"use client";

import { useCallback, useEffect, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasSocial } from "@/components/social/AbasSocial";
import type { JanelaDirect } from "@/app/api/social/janela/route";
import { LIMITES } from "@/lib/templates/regras";

type CampanhaResumo = {
  id: string;
  titulo: string;
  canal: string;
  status: string;
  criadoEm: string;
  contagem: Record<string, number>;
};

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  enviando: "Enviando",
  pausada: "Pausada",
  concluida: "Concluída",
  concluida_com_erros: "Concluída com erros",
  cancelada: "Cancelada",
};

function hora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * Disparo pelo Direct.
 *
 * A tela mostra o tamanho do público ANTES de pedir a mensagem, e isso é o mais importante que ela
 * faz: no Instagram só dá pra falar com quem escreveu nas últimas 24 horas, então o público é
 * pequeno e conhecido. Prometer "disparo em massa" e entregar doze pessoas seria a decepção; dizer
 * doze desde o começo é o produto.
 *
 * Não existe modelo aprovado aqui como no WhatsApp oficial. A janela fechou, acabou. Por isso a
 * lista traz quando a janela de cada pessoa fecha: é a informação que decide se manda agora ou não.
 */
export default function DisparosSociaisPage() {
  const [janela, setJanela] = useState<JanelaDirect | null>(null);
  const [campanhas, setCampanhas] = useState<CampanhaResumo[] | null>(null);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const [j, c] = await Promise.all([
      fetch("/api/social/janela", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/campanhas", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
    ]);
    setJanela((j as JanelaDirect | null) ?? null);
    setCampanhas(Array.isArray(c) ? (c as CampanhaResumo[]).filter((x) => x.canal === "instagram") : []);
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(recarregar)
      .catch(() => setCampanhas([]));
  }, [recarregar]);

  async function disparar() {
    setEnviando(true);
    setAviso(null);
    try {
      const resposta = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim() || texto.split("\n")[0].slice(0, 60),
          corpo: texto,
          canal: "instagram",
          audiencia: { modo: "janela_instagram" },
        }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu certo.");
      setTexto("");
      setTitulo("");
      setAviso("Disparo criado. As mensagens saem no ritmo do canal.");
      await recarregar();
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não deu certo.");
    } finally {
      setEnviando(false);
    }
  }

  const podeDisparar = !!texto.trim() && !!janela?.total && !enviando;

  return (
    <>
      <Topbar title="Disparos" sub="Mensagem pra quem escreveu no Direct nas últimas 24 horas" />
      <AbasSocial />

      <div className="content">
        <section className="card">
          <h3>Quem pode receber agora</h3>
          {!janela ? (
            <p className="hint">Carregando…</p>
          ) : (
            <>
              <p className="hint">
                <strong>{janela.total}</strong>{" "}
                {janela.total === 1 ? "pessoa está" : "pessoas estão"} dentro da janela de{" "}
                {janela.janelaHoras} horas. {LIMITES.instagram.explicacao}
              </p>
              {janela.pessoas.length ? (
                <table className="table mt8">
                  <thead>
                    <tr>
                      <th>Contato</th>
                      <th>Última mensagem dela</th>
                      <th>A janela fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {janela.pessoas.map((p) => (
                      <tr key={p.contatoNome}>
                        <td>{p.contatoNome}</td>
                        <td className="hint">{hora(p.ultimaMensagemEm)}</td>
                        <td className="hint">{hora(p.fechaEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint mt8">
                  Ninguém escreveu nas últimas {janela.janelaHoras} horas. Fora da janela o Instagram
                  recusa a mensagem, e não existe modelo aprovado como no WhatsApp oficial.
                </p>
              )}
              {janela.total > janela.pessoas.length ? (
                <p className="hint">Mostrando as {janela.pessoas.length} mais recentes.</p>
              ) : null}
            </>
          )}
        </section>

        <section className="card mt16">
          <h3>A mensagem</h3>
          <div className="field mt8">
            <label>Nome do disparo (opcional)</label>
            <input
              className="input"
              value={titulo}
              placeholder="Ex.: Aviso de vaga"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Texto</label>
            <textarea
              className="input"
              style={{ minHeight: 110, resize: "vertical" }}
              maxLength={LIMITES.instagram.corpoMaximo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <p className="hint">
              {texto.length}/{LIMITES.instagram.corpoMaximo} caracteres. A janela de cada pessoa é
              conferida de novo na hora do envio: quem sair dela fica marcado com o motivo, em vez
              de virar uma recusa da Meta.
            </p>
          </div>
          {aviso ? <p className="hint">{aviso}</p> : null}
          <button type="button" className="btn primary" disabled={!podeDisparar} onClick={disparar}>
            {enviando ? "Criando…" : `Disparar pra ${janela?.total ?? 0}`}
          </button>
        </section>

        <section className="card mt16">
          <h3>Disparos anteriores</h3>
          {campanhas === null ? (
            <p className="hint">Carregando…</p>
          ) : !campanhas.length ? (
            <p className="hint">Nenhum ainda.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Disparo</th>
                  <th>Situação</th>
                  <th>Enviados</th>
                  <th>Falhas</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id}>
                    <td className="hint">{hora(c.criadoEm)}</td>
                    <td>{c.titulo}</td>
                    <td>
                      <span className={`badge ${c.status === "concluida" ? "badge-success" : c.status === "concluida_com_erros" ? "badge-warning" : "badge-neutral"}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td>{(c.contagem.enviado ?? 0) + (c.contagem.entregue ?? 0) + (c.contagem.lido ?? 0)}</td>
                    <td>{c.contagem.falhou ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
