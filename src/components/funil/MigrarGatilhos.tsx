"use client";

import { useEffect, useState } from "react";

import type { ResultadoDaMigracao } from "@/lib/funil/migrar-gatilhos";

/**
 * O aviso que aparece quando existem automações com o gatilho ainda dentro do fluxo.
 *
 * Fica aqui, na tela de automatizar o funil, e não escondido em Configurações: é aqui que a
 * pessoa está pensando nesse assunto, e é aqui que ela vai reparar que faltam automações na
 * grade. Some sozinho quando não há mais nada a migrar, então não vira mais um item permanente
 * na tela.
 *
 * Mostra o que vai mudar ANTES de mudar. Mexer na automação de um workspace inteiro com um clique
 * cego é o tipo de coisa que não se oferece.
 */
export function MigrarGatilhos({ aoMigrar }: { aoMigrar: () => void }) {
  const [previa, setPrevia] = useState<ResultadoDaMigracao | null>(null);
  const [aberto, setAberto] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/funis/gatilhos/migrar")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ResultadoDaMigracao | null) => {
        if (vivo && dados) setPrevia(dados);
      })
      // Silêncio de propósito: quem não é admin recebe 403, e isso não é um erro pra mostrar.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function migrar() {
    setMigrando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/funis/gatilhos/migrar", { method: "POST" });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as ResultadoDaMigracao;
      setFeito(dados.migrados.length);
      setPrevia(null);
      aoMigrar();
    } catch {
      setErro("Não deu pra migrar agora. Tente de novo.");
    } finally {
      setMigrando(false);
    }
  }

  if (feito !== null) {
    return (
      <div className="migrar-aviso pronto">
        <strong>
          {feito} automaç{feito === 1 ? "ão passou" : "ões passaram"} a ser executada
          {feito === 1 ? "" : "s"} pela etapa.
        </strong>
        <span>Elas já aparecem na grade abaixo. Os blocos de gatilho continuam nos fluxos.</span>
      </div>
    );
  }

  if (!previa?.migrados.length) return null;

  return (
    <div className="migrar-aviso">
      <div className="migrar-aviso-texto">
        <strong>
          {previa.migrados.length} automaç{previa.migrados.length === 1 ? "ão tem" : "ões têm"} o
          gatilho dentro do fluxo, não na etapa.
        </strong>
        <span>
          Elas funcionam, mas não aparecem nesta grade. Trazendo pra cá, a etapa passa a ser a dona
          do gatilho e você vê tudo num lugar só. Nada é apagado.
        </span>
      </div>

      {aberto ? (
        <ul className="migrar-lista">
          {previa.migrados.map((m) => (
            <li key={m.fluxoId}>
              <b>{m.fluxoNome}</b> → etapa <b>{m.etapaTitulo}</b>
              {m.ativo ? "" : " (está pausada, continua pausada)"}
            </li>
          ))}
          {previa.semEtapa.length ? (
            <li className="hint">
              {previa.semEtapa.length} automaç{previa.semEtapa.length === 1 ? "ão fica" : "ões ficam"} de
              fora: {previa.semEtapa.map((s) => s.fluxoNome).join(", ")} — o gatilho não tem etapa
              escolhida, então não dá pra saber pra qual etapa iria.
            </li>
          ) : null}
        </ul>
      ) : null}

      {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}

      <div className="migrar-aviso-fim">
        <button type="button" className="btn ghost" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Esconder" : "Ver o que vai mudar"}
        </button>
        <button type="button" className="btn primary" onClick={migrar} disabled={migrando}>
          {migrando ? "Trazendo…" : "Trazer pra grade"}
        </button>
      </div>
    </div>
  );
}
