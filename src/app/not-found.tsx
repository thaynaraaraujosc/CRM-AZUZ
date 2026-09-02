import Link from "next/link";

/**
 * Página não encontrada, com a cara do produto.
 *
 * Sem este arquivo, o Next mostra a tela padrão dele — fundo branco, tipografia do framework e
 * nenhuma menção ao CRM. Pra quem está avaliando o produto, isso lê como "aplicação genérica", e
 * pra quem já é cliente lê como "quebrou".
 */
export default function NaoEncontrada() {
  return (
    <main className="pagina-erro">
      <p className="pagina-erro-marca">azuz crm</p>
      <h1>Essa página não existe</h1>
      <p className="pagina-erro-texto">
        O endereço pode ter mudado, ou o link que te trouxe até aqui está desatualizado.
      </p>
      <Link className="btn" href="/inicio">
        Voltar para o início
      </Link>
    </main>
  );
}
