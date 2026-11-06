"use client";

import { useEffect } from "react";

/**
 * Erro inesperado, com a cara do produto. E sem contar nada demais.
 *
 * O que aparece na tela é uma frase e um botão. Nada de pilha de execução, caminho de arquivo,
 * nome de tabela ou versão de biblioteca: isso é mapa da aplicação pra quem estiver procurando
 * brecha, e ruído incompreensível pra quem só quer trabalhar.
 *
 * O detalhe continua existindo no log do servidor, que é onde ele serve pra alguma coisa. O
 * `digest` é o código que liga esta tela àquele log. É o que a pessoa informa no suporte.
 *
 * E QUANDO NÃO HÁ `digest`, MOSTRA A MENSAGEM. O `digest` só existe pra erro que aconteceu no
 * SERVIDOR; quando a falha é no navegador — que é a maioria das que a pessoa encontra usando —
 * ele vem vazio, e esta tela dizia "informe o código abaixo" sem código nenhum embaixo. Um
 * pedido de ajuda que não pode ser atendido: quem reporta só consegue dizer "deu erro", e do
 * outro lado não há por onde começar.
 *
 * A mensagem de um erro de JavaScript não é pilha nem caminho de arquivo — é uma frase do tipo
 * "Cannot read properties of undefined". Não desenha o mapa da aplicação pra ninguém, e é a
 * diferença entre um defeito consertado hoje e um defeito que volta na semana que vem.
 */
/**
 * O que mostrar quando não há `digest`: a primeira linha da mensagem, cortada.
 *
 * Cortada porque mensagem de erro de biblioteca às vezes vem com parágrafos e um link; o que
 * serve pra identificar o defeito está sempre no começo. Sem mensagem nenhuma, um texto fixo —
 * nunca um espaço em branco embaixo da frase que pede o código.
 */
function codigoLegivel(error: Error): string {
  const primeira = (error.message ?? "").split("\n")[0].trim();
  if (!primeira) return "sem código (falha no navegador)";
  return primeira.length > 140 ? `${primeira.slice(0, 140)}…` : primeira;
}

export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro] falha inesperada na interface:", error.message);
  }, [error]);

  return (
    <main className="pagina-erro">
      <p className="pagina-erro-marca">azuz crm</p>
      <h1>Algo deu errado por aqui</h1>
      <p className="pagina-erro-texto">
        Já registramos o problema. Tente de novo: se continuar, fale com o suporte informando o
        código abaixo.
      </p>
      <code className="pagina-erro-codigo">{error.digest ?? codigoLegivel(error)}</code>
      <button type="button" className="btn" onClick={reset}>
        Tentar de novo
      </button>
    </main>
  );
}
