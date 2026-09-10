"use client";

import { useEffect, useState } from "react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { EXPEDIENTE_PADRAO, type DiasDoExpediente, type Expediente } from "@/lib/expediente";

/**
 * O horário de funcionamento do workspace.
 *
 * Um só, usado por todo mundo que precisa saber "estamos abertos agora?": a pausa "só em horário
 * de expediente", o follow-up de quem não respondeu e a janela dos gatilhos de etapa. Ter um
 * horário por lugar faria o follow-up de duas horas chegar às três da manhã enquanto o gatilho
 * respeitava o comercial.
 */
const DIAS: { chave: keyof DiasDoExpediente; label: string }[] = [
  { chave: "1", label: "Segunda" },
  { chave: "2", label: "Terça" },
  { chave: "3", label: "Quarta" },
  { chave: "4", label: "Quinta" },
  { chave: "5", label: "Sexta" },
  { chave: "6", label: "Sábado" },
  { chave: "7", label: "Domingo" },
];

export function ExpedienteSecao() {
  const [expediente, setExpediente] = useState<Expediente>(EXPEDIENTE_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/expediente")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: Expediente | null) => {
        if (vivo && dados?.dias) setExpediente(dados);
        if (vivo) setCarregando(false);
      })
      .catch(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function alternarDia(chave: keyof DiasDoExpediente) {
    const dias = { ...expediente.dias };
    // Fechar é TIRAR o dia, não zerar o horário: um dia com "00:00 às 00:00" abriria uma janela de
    // zero minuto que nunca é verdadeira, e a conta de "próxima abertura" nunca chegaria nele.
    if (dias[chave]) delete dias[chave];
    else dias[chave] = { de: "08:00", ate: "18:00" };
    setExpediente({ ...expediente, dias });
  }

  function mudarHora(chave: keyof DiasDoExpediente, campo: "de" | "ate", valor: string) {
    const faixa = expediente.dias[chave];
    if (!faixa) return;
    setExpediente({ ...expediente, dias: { ...expediente.dias, [chave]: { ...faixa, [campo]: valor } } });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const resposta = await fetch("/api/expediente", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expediente),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro || "falhou");
      setAviso("Expediente salvo.");
    } catch (e) {
      setErro(e instanceof Error && e.message !== "falhou" ? e.message : "Não deu pra salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="hint">Carregando…</p>;

  return (
    /*
      Mesma casca de todas as outras categorias de Configurações: `config-secao` +
      `CabecalhoCategoria` + `config-bloco`.

      Antes esta era a única que usava `card` + `panel-h`. E `panel-h` é uma linha com o título à
      esquerda e a AÇÃO à direita: pôr a frase explicativa nela empurrava a justificativa pro canto
      direito da tela, espremida e longe do título que ela explica. Duas linguagens visuais na
      mesma tela, e a errada era a que tinha mais texto pra ler.
    */
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Horário de funcionamento"
        descricao={'Usado pela pausa "só em horário de expediente", pelo follow-up de quem não respondeu e pela janela dos gatilhos de etapa. Um só, pra os três não divergirem.'}
      />

      <div className="config-bloco">
        <div className="expediente-dias">
          {DIAS.map((dia) => {
            const faixa = expediente.dias[dia.chave];
            return (
              <div key={dia.chave} className="expediente-linha">
                <label className="expediente-dia">
                  <input type="checkbox" checked={!!faixa} onChange={() => alternarDia(dia.chave)} />
                  <span>{dia.label}</span>
                </label>
                {faixa ? (
                  <div className="expediente-horas">
                    <input
                      type="time"
                      className="input"
                      value={faixa.de}
                      onChange={(e) => mudarHora(dia.chave, "de", e.target.value)}
                      aria-label={`Abre ${dia.label}`}
                    />
                    <span>às</span>
                    <input
                      type="time"
                      className="input"
                      value={faixa.ate}
                      onChange={(e) => mudarHora(dia.chave, "ate", e.target.value)}
                      aria-label={`Fecha ${dia.label}`}
                    />
                  </div>
                ) : (
                  <span className="hint expediente-fechado">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {erro ? (
        <p className="hint" style={{ color: "var(--danger)" }}>
          {erro}
        </p>
      ) : null}
      {aviso ? <p className="hint">{aviso}</p> : null}

      <div className="config-acoes">
        <button type="button" className="btn primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar expediente"}
        </button>
      </div>
    </div>
  );
}
