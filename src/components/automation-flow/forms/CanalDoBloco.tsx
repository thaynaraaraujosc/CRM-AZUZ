"use client";

import { Ajuda } from "@/components/ui";
import type { CanalMensagem } from "@/lib/automation-flow/types";
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { useIdioma } from "@/lib/idioma-context";
import {
  avisoDeJanela,
  canaisDaAreaParaBloco,
  destinoDoBloco,
  DESTINOS_INSTAGRAM,
  type DestinoInstagram,
} from "./canais";

/**
 * O CANAL DO BLOCO DE MENSAGEM.
 *
 * Estava copiado em três formulários, com a mesma caixa de escolha em cada um, e com um detalhe
 * errado nos três: num robô de Instagram existe UM canal, e a caixa oferecia uma escolha de uma
 * opção só. "Ali está escrito Direct, quais canais? Todos. Mas não é todos." Caixa de escolha que
 * não escolhe ensina a desconfiar das que escolhem.
 *
 * Com um canal só, ele é INFORMAÇÃO: a linha diz qual é, e pronto. Com dois ou mais — que é o robô
 * comercial, onde ainda vai entrar e-mail — volta a ser escolha.
 */
export function CanalDoBloco({
  area,
  valor,
  onChange,
  destino,
  aoMudarDestino,
}: {
  area: AreaAutomacao;
  valor?: string;
  onChange: (canal: CanalMensagem) => void;
  /** O destino gravado no bloco (`destino`). Só vale no Instagram. Ver `DESTINOS_INSTAGRAM`. */
  destino?: unknown;
  aoMudarDestino?: (destino: DestinoInstagram) => void;
}) {
  const { t: traduzir } = useIdioma();
  const canais = canaisDaAreaParaBloco(area);
  const janela = avisoDeJanela(area);
  const atual = valor ?? canais[0]?.valor ?? "whatsapp";
  /*
   * O INSTAGRAM TEM UM CANAL E DOIS LUGARES ONDE ESCREVER.
   *
   * O canal continua sendo informação — é um só —, mas o DESTINO é escolha: Direct ou resposta
   * pública embaixo do comentário. É a mesma escolha do cartão no canvas, e as duas leem do mesmo
   * campo, porque duas telas que gravam o mesmo dado em lugares diferentes é como se perde o dado.
   */
  const escolheDestino = atual === "instagram" && !!aoMudarDestino;
  const destinoAtual = destinoDoBloco(destino === undefined ? undefined : { destino });

  return (
    <div className="field">
      <label>
        {traduzir("Canal")}
        {janela ? <Ajuda texto={janela} /> : null}
      </label>
      {canais.length > 1 ? (
        <select className="input" value={atual} onChange={(e) => onChange(e.target.value as CanalMensagem)}>
          {canais.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <p className="flow-canal-unico">{canais.find((c) => c.valor === atual)?.label ?? atual}</p>
      )}

      {escolheDestino ? (
        <>
          <label className="flow-destino-rotulo">
            {traduzir("Onde o robô escreve")}
            <Ajuda
              texto={traduzir(
                "A resposta pública só sai quando a automação foi disparada por um comentário. Num fluxo que começou por Direct, esse passo é registrado como ignorado em vez de ser publicado em outro lugar.",
              )}
            />
          </label>
          <select
            className="input"
            value={destinoAtual}
            onChange={(e) => aoMudarDestino?.(e.target.value as DestinoInstagram)}
          >
            {DESTINOS_INSTAGRAM.map((d) => (
              <option key={d.valor} value={d.valor}>
                {traduzir(d.label)}
              </option>
            ))}
          </select>
          <p className="hint">
            {traduzir(DESTINOS_INSTAGRAM.find((d) => d.valor === destinoAtual)?.descricao ?? "")}
          </p>
        </>
      ) : null}
    </div>
  );
}
