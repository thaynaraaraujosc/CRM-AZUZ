"use client";

import { useEffect } from "react";

/**
 * Erro inesperado, com a cara do produto — e sem contar nada demais.
 *
 * O que aparece na tela é uma frase e um botão. Nada de pilha de execução, caminho de arquivo,
 * nome de tabela ou versão de biblioteca: isso é mapa da aplicação pra quem estiver procurando
 * brecha, e ruído incompreensível pra quem só quer trabalhar.
 *
 * O detalhe continua existindo no log do servidor, que é onde ele serve pra alguma coisa. O
 * `digest` é o código que liga esta tela àquele log — é o que a pessoa informa no suporte.
 */
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
        Já registramos o problema. Tente de novo — se continuar, fale com o suporte informando o
        código abaixo.
      </p>
      {error.digest ? <code className="pagina-erro-codigo">{error.digest}</code> : null}
      <button type="button" className="btn" onClick={reset}>
        Tentar de novo
      </button>
    </main>
  );
}
