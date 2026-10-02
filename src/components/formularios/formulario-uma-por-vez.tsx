"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PerguntaVisualizacao } from "@/components/campo-resposta";
import type { EnderecoDoCep } from "@/lib/formularios/documentos";
import {
  mostraPaginas,
  mostraTitulo,
  numeraPerguntas,
  type Formulario,
  type PerguntaFormulario,
} from "@/lib/formularios-context";
import { erroDaPergunta, passosDoFormulario, type PassoDoFormulario } from "@/lib/formularios/passo-a-passo";

type OpcaoNome = { id: string; nome: string };

/** Depois de clicar numa opção, o tempo de ver a escolha marcada antes de a próxima pergunta entrar. */
const ESPERA_DA_ESCOLHA_MS = 350;

/**
 * O formulário uma pergunta por vez (2026-09-16).
 *
 * Cada pergunta ocupa o cartão, e a próxima só aparece depois de responder. A agência escolhe esse jeito na
 * aba Design; o formulário completo continua sendo o padrão. As respostas ficam no `FormularioPublico`, que
 * é quem envia: aqui é só o caminho de uma pergunta até a outra.
 */
export function FormularioUmaPorVez({
  formulario,
  valores,
  onMudarValor,
  onEnviar,
  responsaveis,
  aoAcharEndereco,
}: {
  formulario: Formulario;
  valores: Record<string, string>;
  onMudarValor: (perguntaId: string, valor: string) => void;
  onEnviar: () => Promise<void> | void;
  responsaveis: OpcaoNome[];
  /** O CEP deste passo achou o endereço: os campos de rua, bairro, cidade e estado dos passos
   *  seguintes já chegam preenchidos. */
  aoAcharEndereco?: (endereco: EnderecoDoCep) => void;
}) {
  const passos = useMemo(() => passosDoFormulario(formulario, valores), [formulario, valores]);
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const indiceRef = useRef(0);

  // Voltar numa resposta pode fechar perguntas à frente: o passo aberto nunca passa do último que existe.
  const atual = Math.min(indice, Math.max(passos.length - 1, 0));
  const passo = passos[atual] ?? null;
  const ultimo = atual >= passos.length - 1;
  const totalDePerguntas = passos.filter((p) => p.pergunta).length;
  const numero = passos.slice(0, atual + 1).filter((p) => p.pergunta).length;

  useEffect(() => {
    indiceRef.current = atual;
    // Quem responde já pode digitar: o cursor vai pro campo da pergunta nova, sem pular a página.
    const campo = areaRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    campo?.focus({ preventScroll: true });
  }, [atual]);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    try {
      await onEnviar();
    } finally {
      setEnviando(false);
    }
  }

  function avancar(respostas: Record<string, string> = valores) {
    if (!passo) return;
    const mensagem = passo.pergunta ? erroDaPergunta(passo.pergunta, respostas) : null;
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    setErro(null);
    // A resposta que acabou de ser dada pode ter aberto ou fechado perguntas à frente.
    if (atual >= passosDoFormulario(formulario, respostas).length - 1) {
      void enviar();
      return;
    }
    setIndice(atual + 1);
  }

  function voltar() {
    setErro(null);
    setIndice(Math.max(0, atual - 1));
  }

  function responder(pergunta: PerguntaFormulario, valor: string) {
    onMudarValor(pergunta.id, valor);
    setErro(null);
    // Escolha de uma opção só não precisa de OK: clicou, a próxima pergunta entra. No último passo não envia
    // sozinho, porque enviar é a decisão de quem responde.
    if (pergunta.tipo === "opcao_unica" && valor && !ultimo) {
      const passoDoClique = atual;
      const respostas = { ...valores, [pergunta.id]: valor };
      window.setTimeout(() => {
        if (indiceRef.current === passoDoClique) avancar(respostas);
      }, ESPERA_DA_ESCOLHA_MS);
    }
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "Enter" || evento.defaultPrevented || evento.nativeEvent.isComposing) return;
    const alvo = evento.target as HTMLElement;
    // Botão e link já respondem ao Enter sozinhos.
    if (alvo.tagName === "BUTTON" || alvo.tagName === "A") return;
    // No texto longo, Enter é quebra de linha; lá, Ctrl ou Cmd + Enter é que avança.
    if (alvo.tagName === "TEXTAREA" && !(evento.metaKey || evento.ctrlKey)) return;
    evento.preventDefault();
    avancar();
  }

  if (!passo) {
    return (
      <p className="hint" style={{ margin: "10px 0" }}>
        Este formulário ainda não tem perguntas. Avise quem te mandou o link.
      </p>
    );
  }

  const pergunta = passo.pergunta;

  return (
    <div className={`form-passo-area${mostraPaginas(formulario.tema) ? "" : " sem-paginas"}`} onKeyDown={aoTeclar}>
      {mostraPaginas(formulario.tema) ? <Progresso numero={numero} total={totalDePerguntas} cor={formulario.tema.corBotao} /> : null}

      {/* A chave troca a cada passo: é o que faz a pergunta nova entrar com a transição, em vez de só trocar o texto. */}
      <div key={pergunta?.id ?? `fim-${atual}`} ref={areaRef} className="form-passo">
        <CabecalhoDoPasso passo={passo} mostrarTitulo={mostraTitulo(formulario.tema)} />
        {passo.blocos.map((bloco) => (
          <PerguntaVisualizacao key={bloco.id} pergunta={bloco} indice={0} interativo valor={bloco.valorPadrao ?? ""} />
        ))}
        {pergunta ? (
          <PerguntaVisualizacao
            pergunta={pergunta}
            indice={numeraPerguntas(formulario.tema) ? numero : 0}
            interativo
            valor={valores[pergunta.id] ?? pergunta.valorPadrao ?? ""}
            onMudarValor={(valor) => responder(pergunta, valor)}
            erro={erro ?? undefined}
            responsaveisDisponiveis={responsaveis}
            aoAcharEndereco={aoAcharEndereco}
          />
        ) : null}
      </div>

      <div className="filters-row" style={{ marginTop: 14 }}>
        {atual > 0 ? (
          <button type="button" className="btn ghost" onClick={voltar} disabled={enviando}>
            Voltar
          </button>
        ) : null}
        <button
          type="button"
          className="btn block"
          style={{ background: formulario.tema.corBotao, color: "#fff" }}
          onClick={() => avancar()}
          disabled={enviando}
        >
          {ultimo ? "Enviar" : "OK"}
        </button>
      </div>
      {!ultimo ? <p className="hint form-passo-dica">ou aperte Enter</p> : null}
    </div>
  );
}

function CabecalhoDoPasso({ passo, mostrarTitulo }: { passo: PassoDoFormulario; mostrarTitulo: boolean }) {
  if (!passo.comecaPagina) return null;
  return (
    <>
      {passo.pagina.titulo && mostrarTitulo ? (
        <h4 style={{ margin: "6px 0 10px" }}>{passo.pagina.titulo}</h4>
      ) : null}
      {passo.pagina.descricao ? (
        <p className="hint" style={{ marginBottom: 10 }}>
          {passo.pagina.descricao}
        </p>
      ) : null}
    </>
  );
}

function Progresso({ numero, total, cor }: { numero: number; total: number; cor: string }) {
  if (total <= 1) return null;
  return (
    <div className="form-passo-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={numero}>
      <span className="form-passo-progresso-texto">
        {numero} de {total}
      </span>
      <span className="form-passo-progresso-trilho">
        <span className="form-passo-progresso-barra" style={{ width: `${(numero / total) * 100}%`, background: cor }} />
      </span>
    </div>
  );
}

/**
 * A prévia da aba Design no modo uma pergunta por vez: o primeiro passo, como quem abre o link vê. Mostrar a
 * lista inteira aqui mentiria sobre a tela do cliente, que é o que a prévia existe pra não fazer.
 */
export function PreviaUmaPorVez({ formulario }: { formulario: Formulario }) {
  const passos = passosDoFormulario(formulario, {});
  // As setas (29/09/2026): antes a prévia mostrava a primeira pergunta e parava ali. Quem escolhe
  // "uma pergunta por vez" está justamente montando um caminho, e não dava pra ver o caminho sem
  // publicar e abrir o link. Aqui elas só andam entre as perguntas; responder de verdade continua
  // sendo coisa da tela pública.
  const [indice, setIndice] = useState(0);
  const atual = Math.min(indice, Math.max(0, passos.length - 1));
  const passo = passos[atual];
  if (!passo) {
    return <p className="hint">Nenhuma pergunta ainda. Adicione uma na aba Editar pra ver aqui.</p>;
  }
  const perguntas = passos.filter((p) => p.pergunta).length;
  const numeroDaPergunta = passos.slice(0, atual + 1).filter((p) => p.pergunta).length;

  return (
    <div className={`form-passo-area${mostraPaginas(formulario.tema) ? "" : " sem-paginas"}`}>
      {mostraPaginas(formulario.tema) ? (
        <Progresso numero={numeroDaPergunta} total={perguntas} cor={formulario.tema.corBotao} />
      ) : null}
      <div className="form-passo">
        <CabecalhoDoPasso passo={passo} mostrarTitulo={mostraTitulo(formulario.tema)} />
        {passo.blocos.map((bloco) => (
          <PerguntaVisualizacao key={bloco.id} pergunta={bloco} indice={0} />
        ))}
        {passo.pergunta ? (
          <PerguntaVisualizacao
            pergunta={passo.pergunta}
            indice={numeraPerguntas(formulario.tema) ? numeroDaPergunta : 0}
          />
        ) : null}
      </div>

      {passos.length > 1 ? (
        <div className="previa-setas">
          <button type="button" onClick={() => setIndice(Math.max(0, atual - 1))} disabled={atual === 0} aria-label="Pergunta anterior">
            ‹
          </button>
          <span>
            {atual + 1} de {passos.length}
          </span>
          <button
            type="button"
            onClick={() => setIndice(Math.min(passos.length - 1, atual + 1))}
            disabled={atual >= passos.length - 1}
            aria-label="Próxima pergunta"
          >
            ›
          </button>
        </div>
      ) : null}
      <div className="filters-row" style={{ marginTop: 14 }}>
        {/* Inerte por `pointer-events`, e não `disabled`: o disabled esmaece o botão, e a prévia existe pra
            mostrar a cor exata que foi escolhida. */}
        <button
          type="button"
          className="btn block"
          style={{ background: formulario.tema.corBotao, color: "#fff", pointerEvents: "none" }}
          tabIndex={-1}
          aria-hidden="true"
        >
          {atual < passos.length - 1 ? "OK" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
