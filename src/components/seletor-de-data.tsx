"use client";

import { useEffect, useRef, useState } from "react";

import { IconCalendar } from "@/components/icons";

/**
 * Seletor de data do CRM — o calendário que a gente controla.
 *
 * Os 19 campos de data do sistema usam `<input type="date">`, que abre o calendário NATIVO do
 * navegador. Aquele calendário não aceita estilo nenhum: ele muda de aparência entre Safari,
 * Chrome e Windows, ignora o tema claro/escuro do CRM e não tem como seguir a identidade azul.
 * Era por isso que "deixar o calendário bonito" não era possível — não havia calendário nosso.
 *
 * Este é. Sem dependência nova: o cálculo de dias é aritmética de `Date`, e a aparência sai dos
 * mesmos tokens do resto do sistema.
 *
 * O `<input type="date">` continua existindo por baixo, escondido, por dois motivos: o formulário
 * continua funcionando igual (mesmo `value`, mesmo `onChange`), e quem usa leitor de tela ou
 * teclado mantém o controle nativo, que é mais acessível que qualquer grade desenhada à mão.
 */

const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** `YYYY-MM-DD` -> Date local. `new Date("2026-06-04")` seria interpretado como UTC e, no Brasil,
 * voltaria um dia. */
function daIso(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

function paraIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Os 42 quadradinhos da grade: o mês inteiro, mais as pontas dos meses vizinhos. */
function diasDaGrade(referencia: Date): Date[] {
  const primeiro = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

export function SeletorDeData({
  valor,
  onChange,
  id,
  disabled,
  className,
}: {
  /** `YYYY-MM-DD`, o mesmo formato do `<input type="date">` que este componente substitui. */
  valor?: string;
  onChange: (iso: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionada = daIso(valor);
  const [mesVisivel, setMesVisivel] = useState(() => selecionada ?? new Date());
  const caixaRef = useRef<HTMLDivElement>(null);

  // Reabrir com uma data nova precisa mostrar o mês dela, não o último que ficou aberto.
  useEffect(() => {
    if (aberto && selecionada) setMesVisivel(selecionada);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir; mudar de mês não deve reverter
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const hoje = new Date();
  const dias = diasDaGrade(mesVisivel);

  function irParaMes(passo: number) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + passo, 1));
  }

  return (
    <div className={`seletor-data${className ? ` ${className}` : ""}`} ref={caixaRef}>
      <button
        type="button"
        id={id}
        className="input seletor-data-campo"
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        <span className={selecionada ? "" : "seletor-data-vazio"}>
          {selecionada
            ? selecionada.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
            : "Escolher data"}
        </span>
        <IconCalendar width={14} height={14} />
      </button>

      {aberto ? (
        <div className="seletor-data-painel" role="dialog" aria-label="Escolher data">
          <div className="seletor-data-topo">
            <button type="button" onClick={() => irParaMes(-1)} aria-label="Mês anterior">
              ‹
            </button>
            <strong>
              {MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
            </strong>
            <button type="button" onClick={() => irParaMes(1)} aria-label="Próximo mês">
              ›
            </button>
          </div>

          <div className="seletor-data-grade">
            {DIAS_DA_SEMANA.map((dia, i) => (
              <span key={`${dia}-${i}`} className="seletor-data-dow">
                {dia}
              </span>
            ))}
            {dias.map((dia) => {
              const deOutroMes = dia.getMonth() !== mesVisivel.getMonth();
              const ehSelecionada = selecionada ? mesmoDia(dia, selecionada) : false;
              return (
                <button
                  key={dia.toISOString()}
                  type="button"
                  className={[
                    "seletor-data-dia",
                    deOutroMes ? "fora" : "",
                    ehSelecionada ? "escolhido" : "",
                    mesmoDia(dia, hoje) ? "hoje" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onChange(paraIso(dia));
                    setAberto(false);
                  }}
                >
                  {dia.getDate()}
                </button>
              );
            })}
          </div>

          <div className="seletor-data-rodape">
            <button type="button" onClick={() => { onChange(paraIso(new Date())); setAberto(false); }}>
              Hoje
            </button>
            {valor ? (
              <button type="button" onClick={() => { onChange(""); setAberto(false); }}>
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
