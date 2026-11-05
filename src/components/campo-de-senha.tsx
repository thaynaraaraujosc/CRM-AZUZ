"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

import { IconOlho, IconOlhoFechado } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * UM CAMPO DE SENHA COM O OLHINHO — o mesmo em todo o CRM.
 *
 * Por que isto é um componente e não um `type="password"` em nove lugares: digitar senha às cegas
 * é onde mais se erra, e o erro só aparece depois, como "senha incorreta". Quem está criando a
 * senha então não sabe se errou agora ou se errou no cadastro. Num celular, com teclado que troca
 * de leiaute e corretor ligado, isso vira duas ou três tentativas até desistir.
 *
 * O padrão continua sendo ESCONDIDO: mostrar por padrão exporia a senha pra quem está ao lado, que
 * é o motivo de o campo existir mascarado. O olho é uma escolha de quem digita, feita na hora.
 *
 * Ele volta a esconder sozinho? Não. Esconder depois de alguns segundos parece zeloso e é pior:
 * a pessoa olha, a senha some no meio da conferência, e ela clica de novo. Quem revelou sabe o
 * que está fazendo.
 */
export function CampoDeSenha({
  id,
  className = "input",
  ...resto
}: InputHTMLAttributes<HTMLInputElement>) {
  const { t: traduzir } = useIdioma();
  const [visivel, setVisivel] = useState(false);
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;

  return (
    <div className="campo-senha">
      <input
        {...resto}
        id={idDoCampo}
        type={visivel ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="campo-senha-olho"
        // `tabIndex={-1}`: quem navega pelo teclado está indo do campo pro botão de entrar, e um
        // parada no olho no meio do caminho atrapalha mais do que ajuda. O clique continua lá.
        tabIndex={-1}
        aria-label={visivel ? traduzir("Esconder a senha") : traduzir("Mostrar a senha")}
        aria-pressed={visivel}
        title={visivel ? traduzir("Esconder a senha") : traduzir("Mostrar a senha")}
        onClick={() => setVisivel((v) => !v)}
      >
        {visivel ? <IconOlhoFechado width={16} height={16} /> : <IconOlho width={16} height={16} />}
      </button>
    </div>
  );
}
