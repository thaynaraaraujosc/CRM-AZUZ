"use client";

import { preencherVariaveis, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import type { BotaoTemplate } from "@/lib/templates/regras";

/** Valores de exemplo pra prévia: o que a pessoa vai ver no lugar de cada `{{variável}}`. */
export function valoresDeExemplo(variaveis: MapeamentoVariavel[]): Record<string, string> {
  const exemplo: Record<string, string> = {
    "contato.nome": "Maria",
    "contato.sobrenome": "Silva",
    "contato.empresa": "Empresa Exemplo",
    "contato.cargo": "Gerente",
    "contato.cidade": "Goiânia",
    "contato.email": "maria@exemplo.com",
    "contato.whatsapp": "(62) 99999-9999",
    "contato.responsavel": "Ana",
  };
  const valores: Record<string, string> = {};
  for (const v of variaveis) {
    valores[v.chave] = v.origem === "texto" ? v.valor?.trim() || `[${v.chave}]` : exemplo[v.origem] ?? `[${v.chave}]`;
  }
  return valores;
}

/**
 * Como a mensagem aparece pra quem recebe: bolha com o texto já preenchido e os botões embaixo.
 * A mesma prévia serve pro editor de template e pro resumo do disparo — quem monta a mensagem e
 * quem confirma o envio precisam olhar pra mesma coisa.
 */
export function PreviaMensagem({
  corpo,
  variaveis,
  botoes,
  assunto,
  valores,
  titulo = "A pessoa vai receber",
}: {
  corpo: string;
  variaveis: MapeamentoVariavel[];
  botoes?: BotaoTemplate[] | null;
  assunto?: string | null;
  /** Valores reais (de uma pessoa específica). Sem eles, usa exemplos. */
  valores?: Record<string, string>;
  titulo?: string;
}) {
  const texto = preencherVariaveis(corpo, valores ?? valoresDeExemplo(variaveis));
  const lista = (botoes ?? []).filter((b) => b.texto?.trim());
  return (
    <div className="tpl-previa">
      <span className="tpl-previa-titulo">{titulo}</span>
      <div className="tpl-bolha">
        {assunto ? <strong className="tpl-bolha-assunto">{preencherVariaveis(assunto, valores ?? valoresDeExemplo(variaveis))}</strong> : null}
        <p>{texto || "Sua mensagem aparece aqui."}</p>
      </div>
      {lista.length ? (
        <div className="tpl-bolha-botoes">
          {lista.map((b, i) => (
            <span key={`${b.texto}-${i}`}>{b.texto}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
