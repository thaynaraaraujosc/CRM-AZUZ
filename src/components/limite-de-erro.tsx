"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Barreira de erro — impede que a falha de UMA parte da tela derrube a tela inteira.
 *
 * No React, um erro durante a renderização sobe até achar quem o segure. Sem ninguém no caminho,
 * ele chega na barreira da rota e a página inteira é substituída pela tela de "Algo deu errado".
 * Numa lista de conversas isso significa que uma única mensagem com dado estranho — vindo de um
 * webhook antigo, de um anexo de tipo novo, de um campo que mudou de forma — apaga o atendimento
 * inteiro, e quem está do outro lado fica sem conseguir trabalhar.
 *
 * Com a barreira, o estrago fica do tamanho do problema: aquela mensagem vira um aviso discreto no
 * lugar dela e o resto da conversa continua funcionando.
 *
 * Isto NÃO é conserto de causa: o erro continua existindo e continua indo pro console com o
 * `rotulo` dizendo onde aconteceu — é assim que se descobre qual mensagem é a culpada, em vez de
 * ficar adivinhando com a tela em branco.
 */
type Props = {
  children: ReactNode;
  /** Onde estamos — vai no log junto do erro, pra saber que pedaço falhou. */
  rotulo: string;
  /** O que mostrar no lugar. Sem isto, mostra uma linha discreta. */
  aoFalhar?: ReactNode;
};

type Estado = { falhou: boolean };

export class LimiteDeErro extends Component<Props, Estado> {
  state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Mensagem e origem no console — é o que permite achar a causa depois, com a tela ainda de pé.
    console.error(`[limite-de-erro] falhou em "${this.props.rotulo}":`, erro.message, info.componentStack);
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      this.props.aoFalhar ?? (
        <p className="limite-de-erro-aviso">Não foi possível mostrar este item.</p>
      )
    );
  }
}
