"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O botão que apaga uma empresa inteira — e a confirmação que ele exige.
 *
 * O NOME DIGITADO NÃO É CERIMÔNIA. Esta tela mostra todas as empresas da plataforma numa lista
 * só, e a distância entre apagar uma conta de teste e apagar um cliente que paga é uma linha de
 * ponteiro. Digitar o nome é o que obriga a olhar DE QUAL conta se está falando — e é a única
 * proteção possível numa ação que não tem desfazer.
 *
 * O que some junto está escrito antes, e não depois: quantos usuários, e que vai tudo (conversas,
 * funil, automações, arquivos). Quem lê isso e mesmo assim digita o nome sabe o que está fazendo.
 */
export function ApagarEmpresa({
  id,
  nome,
  membros,
  aoApagar,
}: {
  id: string;
  nome: string;
  membros: number;
  aoApagar: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setApagando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/admin/workspaces/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmacao }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
        setErro(corpo.erro ?? "Não foi possível apagar.");
        return;
      }
      setAberto(false);
      setConfirmacao("");
      aoApagar();
    } finally {
      setApagando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost danger admin-btn-apagar"
        onClick={() => setAberto(true)}
        aria-label={`${traduzir("Apagar")} ${nome}`}
      >
        {traduzir("Apagar")}
      </button>

      {aberto ? (
        <Modal aberto titulo={`${traduzir("Apagar")} ${nome}`} onFechar={() => setAberto(false)}>
          <p className="hint">
            Isto apaga a empresa inteira e <strong>não tem volta</strong>: {membros}{" "}
            {membros === 1 ? "usuário" : "usuários"}, conversas, contatos, funil, automações,
            arquivos e histórico. A conta deixa de existir e ninguém dela consegue entrar.
          </p>
          <div className="field">
            <label htmlFor={`confirmar-${id}`}>
              {traduzir("Pra confirmar, digite o nome da empresa")}
            </label>
            <input
              id={`confirmar-${id}`}
              className="input"
              value={confirmacao}
              placeholder={nome}
              autoFocus
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>
          {erro ? <p className="auth-erro">{erro}</p> : null}
          <div className="config-acoes">
            <button
              type="button"
              className={`btn danger${apagando ? " loading" : ""}`}
              disabled={apagando || confirmacao.trim().toLowerCase() !== nome.trim().toLowerCase()}
              onClick={() => void apagar()}
            >
              {apagando ? traduzir("Apagando…") : traduzir("Apagar para sempre")}
            </button>
            <button type="button" className="btn ghost" onClick={() => setAberto(false)} disabled={apagando}>
              {traduzir("Cancelar")}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
