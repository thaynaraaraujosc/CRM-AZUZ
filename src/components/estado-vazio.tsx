import type { ReactNode } from "react";

/**
 * A TELA VAZIA, feita de propósito.
 *
 * Conta nova não tem funil, não tem automação, não tem nada — e é esse o primeiro contato do
 * cliente com cada tela do CRM. O que ele via era uma faixa branca colada no topo da página com
 * uma frase cinza dentro, como se a página tivesse quebrado no meio do carregamento.
 *
 * Aqui o vazio é tratado como estado legítimo: espaço em volta, um ícone discreto, uma frase que
 * diz o que falta e UM botão que resolve. O CRM só tem uma primeira impressão por cliente.
 *
 * Deliberadamente sem `.card`: o quadrado branco é o que deixava a tela feia. O que organiza é o
 * espaço e o alinhamento ao centro, não uma caixa.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="estado-vazio">
      {icone ? <div className="estado-vazio-icone">{icone}</div> : null}
      <strong className="estado-vazio-titulo">{titulo}</strong>
      {descricao ? <p className="estado-vazio-texto">{descricao}</p> : null}
      {acao ? <div className="estado-vazio-acao">{acao}</div> : null}
    </div>
  );
}
