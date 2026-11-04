"use client";

import { useIdioma } from "@/lib/idioma-context";

/**
 * ESCOLHER A HORA NUMA LISTA, e não digitando num campo de hora.
 *
 * Era `<input type="time">`. Três problemas, todos relatados pela Thaynara olhando a tela:
 *
 * 1. Vazio, ele desenha "12:30" em cinza — a máscara do formato. Parecia valor preenchido, e não
 *    era: "os números têm que aparecer" quer dizer "quero ver o que está escolhido, de verdade".
 * 2. Pra escolher 14h era preciso digitar, ou clicar na setinha e subir de minuto em minuto.
 * 3. Não tinha como voltar ao vazio depois de ter escolhido.
 *
 * A lista resolve os três: o que está escolhido aparece escrito, a escolha é um clique, e "—" no
 * topo devolve o campo pro vazio.
 *
 * DE MEIA EM MEIA HORA. Quarenta e oito opções já é uma lista comprida; de quinze em quinze
 * seriam noventa e seis, e ninguém agenda o robô pra 14:07. Se o gatilho já tiver uma hora
 * "quebrada" — gravada antes desta tela existir —, ela entra na lista pra não sumir ao abrir.
 */
export const HORARIOS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hora = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hora}:${i % 2 ? "30" : "00"}`;
});

export function SeletorDeHora({
  valor,
  aoMudar,
  rotuloVazio = "—",
  "aria-label": ariaLabel,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  rotuloVazio?: string;
  "aria-label"?: string;
}) {
  const { t: traduzir } = useIdioma();
  // Hora gravada fora da escada de meia hora continua escolhível: tirá-la da lista faria o
  // `select` mostrar outra coisa, e o primeiro salvamento apagaria silenciosamente o valor real.
  const opcoes = valor && !HORARIOS.includes(valor) ? [valor, ...HORARIOS] : HORARIOS;

  return (
    <select
      className={`input fauto-hora${valor ? "" : " vazio"}`}
      value={valor}
      aria-label={ariaLabel}
      onChange={(e) => aoMudar(e.target.value)}
    >
      <option value="">{traduzir(rotuloVazio)}</option>
      {opcoes.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
