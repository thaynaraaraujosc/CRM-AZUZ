/**
 * O que aparece ENTRE o clique e a tela nova.
 *
 * Sem este arquivo o Next segura a tela antiga inteira, congelada, até a próxima terminar de
 * carregar. Numa tela pesada como Conversas isso são segundos em que nada responde. E a leitura
 * de quem está usando não é "está carregando", é "não funcionou, vou clicar de novo".
 *
 * Não é uma barra de progresso nem um spinner girando no meio do vazio: é o CONTORNO da tela que
 * está chegando. A pessoa já vê a página tomando forma, e a espera passa a ser parte da navegação
 * em vez de uma pausa sem explicação.
 */
export default function Carregando() {
  return (
    <div className="tela-carregando" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      <div className="tela-carregando-topo">
        <span className="esqueleto esqueleto-titulo" />
        <span className="esqueleto esqueleto-botao" />
      </div>

      <div className="tela-carregando-corpo">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="esqueleto-linha" key={i}>
            <span className="esqueleto esqueleto-avatar" />
            <div className="esqueleto-linha-texto">
              <span className="esqueleto esqueleto-forte" />
              <span className="esqueleto esqueleto-fraca" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
