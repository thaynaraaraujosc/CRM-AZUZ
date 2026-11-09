"use client";

import { Ajuda } from "@/components/ui";
import type { CanalMensagem } from "@/lib/automation-flow/types";
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { useIdioma } from "@/lib/idioma-context";
import { avisoDeJanela, canaisDaAreaParaBloco } from "./canais";

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
}: {
  area: AreaAutomacao;
  valor?: string;
  onChange: (canal: CanalMensagem) => void;
}) {
  const { t: traduzir } = useIdioma();
  const canais = canaisDaAreaParaBloco(area);
  const janela = avisoDeJanela(area);
  const atual = valor ?? canais[0]?.valor ?? "whatsapp";

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
    </div>
  );
}
