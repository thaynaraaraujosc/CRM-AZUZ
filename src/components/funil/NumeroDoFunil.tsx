"use client";

import { useCallback, useEffect, useState } from "react";

import { IconCheck, IconSetaBaixo } from "@/components/icons";
import { canalDoNumero } from "@/lib/conversas/numeros-conectados";
import {
  numerosDoFunil,
  rotuloDoNumeroDoFunil,
  valeMostrarNumeroDoFunil,
  type NumeroComFunil,
} from "@/lib/funis/numero-do-funil";
import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { useIdioma } from "@/lib/idioma-context";

/**
 * DE QUAL NÚMERO SÃO OS LEADS DESTE FUNIL — na tela do funil, que é onde a pergunta nasce.
 *
 * "Eu criei um funil com o nome do Lucas Chaveiro, é o funil do número 26. Por que que esse número
 * lá não está os contatos que eu estou conversando lá?" E: "tem que ter a opção de ver qual que é o
 * número do funil".
 *
 * A ligação já existia — mora nos metadados da conexão, em Configurações → WhatsApp — e era
 * invisível daqui. Quem abre o quadro não tinha como saber se ele recebe de algum número, nem de
 * qual, nem que a configuração existe. Descobrir isso exigia sair do funil, abrir Configurações,
 * entrar em WhatsApp e ler número por número.
 *
 * GRAVA NO MESMO LUGAR de sempre (`PATCH /api/integracoes/numeros`), e não numa coluna nova no
 * funil: dois donos pra mesma informação é como se chega em duas respostas diferentes pra mesma
 * pergunta. Aqui é a pergunta invertida, feita do outro lado.
 *
 * Só aparece com DOIS números conectados ou mais. Com um só, "o funil deste número" e "o funil da
 * empresa" são a mesma coisa, e a etiqueta seria um controle que nunca muda nada — o mesmo critério
 * do seletor de número na caixa de entrada.
 */
/** O que a rota devolve: `NumeroComFunil` mais o `slot`, que é a metade da chave da conexão. */
type Numero = NumeroComFunil & { slot: number };
type Resposta = { numeros: Numero[] };

export function NumeroDoFunil({ funilId, funilNome }: { funilId: string; funilNome: string }) {
  const { t: traduzir } = useIdioma();
  const [numeros, setNumeros] = useState<Numero[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = useCallback(() => setAberto(false), []);
  useFecharMenuDeLinha(aberto, fechar);

  /**
   * Busca e DEVOLVE, em vez de gravar no estado.
   *
   * Assim o efeito de montagem grava num callback (`.then`) e não no corpo, que é o que a regra
   * `react-hooks/set-state-in-effect` cobra — e com razão: `setState` no corpo de um efeito
   * encadeia renderizações. Quem precisa recarregar depois de salvar chama a mesma função e grava
   * ele mesmo, sem uma segunda cópia da leitura.
   *
   * Lista vazia em qualquer falha, e não `null`: a etiqueta desaparece em vez de ficar dizendo
   * "Carregando…" pra sempre. Saber de qual número é o funil é informação útil, não indispensável —
   * e um erro aqui não pode roubar a atenção de quem veio trabalhar o funil.
   */
  const buscar = useCallback(async (): Promise<Numero[]> => {
    const r = await fetch("/api/integracoes/numeros").catch(() => null);
    if (!r?.ok) return [];
    const corpo = (await r.json().catch(() => null)) as Resposta | null;
    return corpo?.numeros ?? [];
  }, []);

  useEffect(() => {
    // `vivo` porque a resposta pode chegar depois de a página trocar: gravar aí avisaria o React
    // de um estado que não tem mais tela.
    let vivo = true;
    buscar().then((lista) => {
      if (vivo) setNumeros(lista);
    });
    return () => {
      vivo = false;
    };
  }, [buscar]);

  if (!numeros || !valeMostrarNumeroDoFunil(numeros)) return null;

  const meus = numerosDoFunil(numeros, funilId);
  const conectados = numeros.filter((n) => n.chave);

  /**
   * TROCAR O NÚMERO DESTE FUNIL são duas escritas, não uma.
   *
   * O vínculo é gravado no NÚMERO, então apontar o número novo pra cá não desfaz o apontamento do
   * antigo: sem limpar, os dois mandariam lead pro mesmo quadro e a etiqueta passaria a dizer
   * "Lucas +1" sem ninguém ter pedido. Limpar primeiro e apontar depois deixa o estado intermediário
   * sendo "nenhum número", que é inofensivo; a ordem contrária deixaria "dois números" como estado
   * intermediário.
   */
  async function escolher(chave: string | null) {
    setSalvando(true);
    setErro(null);
    setAberto(false);

    const paraLimpar = meus.filter((n) => n.chave !== chave);
    const paraApontar = chave ? conectados.find((n) => n.chave === chave) : undefined;

    for (const n of paraLimpar) {
      if (!(await patch(n, null))) break;
    }
    if (paraApontar) await patch(paraApontar, funilId);

    setNumeros(await buscar());
    setSalvando(false);
  }

  async function patch(numero: Numero, valor: string | null): Promise<boolean> {
    const r = await fetch("/api/integracoes/numeros", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provedor: numero.provedor, slot: numero.slot, funilId: valor }),
    }).catch(() => null);
    if (r?.ok) return true;
    const corpo = (await r?.json().catch(() => null)) as { erro?: string } | null;
    // A rota só deixa administrador mexer em conexão, e essa recusa precisa aparecer com as
    // palavras dela: "não salvou" sem o motivo faz a pessoa tentar de novo pra sempre.
    setErro(corpo?.erro ?? traduzir("Não deu pra salvar o número deste funil."));
    return false;
  }

  return (
    <div className="dropdown-anchor" data-menu-de-linha="">
      <button
        type="button"
        className={`btn ghost${aberto ? " active" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={salvando}
        title={`${traduzir("De qual número de WhatsApp são os leads deste funil")}: ${funilNome}`}
        onClick={() => setAberto((v) => !v)}
      >
        {salvando ? traduzir("Salvando…") : rotuloDoNumeroDoFunil(numeros, funilId)}
        <IconSetaBaixo width={12} height={12} aria-hidden="true" style={{ marginLeft: 6 }} />
      </button>

      {aberto ? (
        <div className="dropdown-pop" role="listbox" aria-label={traduzir("Número deste funil")}>
          <button
            type="button"
            role="option"
            aria-selected={meus.length === 0}
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => void escolher(null)}
          >
            <span className="n">
              {meus.length === 0 ? <IconCheck width={12} height={12} aria-hidden="true" /> : null}{" "}
              {traduzir("Todos os números")}
            </span>
            <span className="r">{traduzir("Recebe o que não tem número próprio")}</span>
          </button>
          {conectados.map((n) => {
            const escolhido = n.funilId === funilId;
            return (
              <button
                key={n.chave}
                type="button"
                role="option"
                aria-selected={escolhido}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => void escolher(n.chave)}
              >
                <span className="n">
                  {escolhido ? <IconCheck width={12} height={12} aria-hidden="true" /> : null} {n.nome}
                </span>
                <span className="r">
                  {/* O canal, e não o número: é ele que muda o que dá pra fazer na conversa
                      (janela de 24 horas e modelo aprovado no oficial, nada disso no QR Code), e é
                      a mesma etiqueta que a caixa de entrada mostra embaixo de cada aba. */}
                  {canalDoNumero(n.provedor)}
                  {/* Desconectado continua escolhível: o vínculo é configuração, não estado, e vale
                      de novo quando o número voltar. O que não pode é a lista omitir o aviso e a
                      pessoa achar que apontou pra um número que está recebendo. */}
                  {n.status !== "conectado" ? ` · ${traduzir("desconectado agora")}` : ""}
                  {n.funilId && n.funilId !== funilId ? ` · ${traduzir("hoje vai pra outro funil")}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {erro ? (
        <p className="hint" style={{ margin: "4px 0 0", color: "var(--erro, #c0392b)" }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
