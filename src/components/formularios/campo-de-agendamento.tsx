"use client";

import { useEffect, useMemo, useState } from "react";

import { formatarDia } from "@/lib/agenda/fuso";
import type { DiaComHorarios } from "@/lib/formularios/agendamento";

/**
 * O CAMPO QUE MARCA A REUNIÃO, na tela de quem responde.
 *
 * DOIS PASSOS, NA ORDEM EM QUE SE PENSA: o dia e, dentro dele, a hora. Um calendário cheio com
 * todos os horários ao lado é escolha demais pra quem só queria falar com a empresa.
 *
 * SÓ APARECE DIA COM HORÁRIO LIVRE. Oferecer o dia e, dentro dele, nada — ou pior, oferecer um
 * horário que já foi tomado — é a forma mais rápida de alguém desistir no meio.
 *
 * NÃO PEDE NOME NEM E-MAIL, e isso é diferente do AZUZ Flow, de onde a tela veio. Lá a
 * confirmação sai por e-mail com o convite do Meet, então o e-mail precisava ser perguntado ali.
 * Aqui a confirmação sai por WHATSAPP, e o número já é uma pergunta do próprio formulário
 * (`mapeamentoCrm: "whatsapp"`, que `lerLeadDaResposta` lê). Perguntar de novo dentro do campo
 * seria pedir duas vezes o mesmo dado na mesma tela.
 *
 * O VALOR DO CAMPO É O INSTANTE EM ISO, com fuso. O servidor confere de novo antes de marcar,
 * porque entre escolher e enviar pode passar meia hora e o horário ser tomado por outra pessoa.
 */
export function CampoDeAgendamento({
  formularioId,
  valor,
  desabilitado,
  aoMudar,
}: {
  formularioId: string;
  valor: string;
  desabilitado?: boolean;
  aoMudar: (valor: string) => void;
}) {
  const [dias, setDias] = useState<DiaComHorarios[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const escolhido = useMemo(() => (valor.trim() ? valor.trim() : null), [valor]);

  useEffect(() => {
    let vivo = true;
    void fetch(`/api/formularios/${encodeURIComponent(formularioId)}/horarios`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((d: { dias?: DiaComHorarios[] }) => {
        if (!vivo) return;
        setDias(d.dias ?? []);
        setDiaAberto((atual) => atual ?? d.dias?.[0]?.dia ?? null);
      })
      .catch(() => {
        if (vivo) setErro("Não consegui carregar os horários agora. Recarregue a página.");
      });
    return () => {
      vivo = false;
    };
  }, [formularioId]);

  if (erro) {
    return (
      <p className="hint" role="alert">
        {erro}
      </p>
    );
  }

  if (dias === null) return <p className="hint">Carregando os horários…</p>;

  if (dias.length === 0) {
    return <p className="hint">Nenhum horário livre no momento. Fale com a gente por outro canal.</p>;
  }

  const doDia = dias.find((d) => d.dia === diaAberto);

  return (
    <div className="form-agenda">
      <div className="form-agenda-dias">
        {dias.map((d) => (
          <button
            key={d.dia}
            type="button"
            className={`form-agenda-dia${diaAberto === d.dia ? " ativo" : ""}`}
            disabled={desabilitado}
            aria-pressed={diaAberto === d.dia}
            onClick={() => {
              setDiaAberto(d.dia);
              // Trocar de dia LIMPA a hora: manter a hora de terça com quarta selecionada deixaria
              // a tela dizendo uma coisa e o formulário mandando outra.
              aoMudar("");
            }}
          >
            <span className="form-agenda-semana">{formatarDia(d.dia, { weekday: "short" })}</span>
            <span className="form-agenda-numero">{formatarDia(d.dia, { day: "2-digit" })}</span>
            <span className="form-agenda-mes">{formatarDia(d.dia, { month: "short" })}</span>
          </button>
        ))}
      </div>

      {doDia ? (
        <div className="form-agenda-horas">
          {doDia.horarios.map((h) => (
            <button
              key={h.inicio}
              type="button"
              className={`form-agenda-hora${escolhido === h.inicio ? " ativo" : ""}`}
              disabled={desabilitado}
              aria-pressed={escolhido === h.inicio}
              onClick={() => aoMudar(h.inicio)}
            >
              {h.hora}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
