"use client";

import type { ReactNode } from "react";

import { Ajuda } from "@/components/ui";
import { IconExpandir } from "@/components/icons";

/**
 * UM CARTÃO QUE ABRE, com a cor da origem.
 *
 * Nasceu dentro da tela de Formulários, pros dois grupos de lá (Flow e CRM). Saiu pra cá quando as
 * Proteções do número — que ficam na mesma tela, logo acima — precisaram abrir e fechar do mesmo
 * jeito: duas peças que se parecem mas são escritas duas vezes divergem na primeira mudança.
 *
 * O cabeçalho é o botão inteiro — a seta é desenho, não alvo. Uma seta de 14px é alvo ruim no
 * celular, e quem lê "Formulários do Flow · 5" espera que clicar no texto também abra.
 *
 * O "?" fica FORA desse botão, no canto direito. Não é capricho: botão dentro de botão é HTML
 * inválido, e o navegador decide sozinho o que fazer com o clique.
 */
export function GrupoRecolhivel({
  tom = "neutro",
  titulo,
  explicacao,
  ajuda,
  contagem,
  resumo,
  aberto,
  aoAlternar,
  children,
}: {
  /** A origem, que vira cor: ouro no Flow, azul no CRM, cinza no que não é origem nenhuma. */
  tom?: "ouro" | "azul" | "neutro";
  titulo: string;
  explicacao?: string;
  /** O texto do "?" do cabeçalho. É onde vai a explicação que não precisa estar sempre à vista. */
  ajuda?: string;
  contagem?: number;
  /**
   * O que o grupo diz FECHADO, numa linha.
   *
   * Fechar um grupo não pode significar perder a resposta: nas Proteções, "05:00–23:00 · 30 por
   * dia" é a configuração inteira em oito palavras, e só quem vai mudá-la precisa abrir.
   */
  resumo?: string;
  aberto: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`card fgrupo ${tom}${aberto ? " aberto" : ""}`}>
      <div className="fgrupo-topo">
        <button type="button" className="fgrupo-cabecalho" onClick={aoAlternar} aria-expanded={aberto}>
          <span className="fgrupo-marca" aria-hidden="true" />
          <span className="fgrupo-textos">
            <span className="fgrupo-titulo">{titulo}</span>
            {explicacao ? <span className="fgrupo-explicacao">{explicacao}</span> : null}
          </span>
          {!aberto && resumo ? <span className="fgrupo-resumo">{resumo}</span> : null}
          {contagem !== undefined ? <span className="fgrupo-contagem">{contagem}</span> : null}
          <IconExpandir className="fgrupo-seta" width={14} height={14} aria-hidden="true" />
        </button>
        {ajuda ? <Ajuda texto={ajuda} /> : null}
      </div>
      {aberto ? <div className="fgrupo-corpo">{children}</div> : null}
    </section>
  );
}
