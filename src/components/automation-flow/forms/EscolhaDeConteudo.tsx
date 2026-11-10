"use client";

import { useCallback, useState } from "react";

import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import type { FlowNodeType } from "@/lib/automation-flow/types";
import {
  IconConversas,
  IconDoc,
  IconSetaBaixo,
  IconImage,
  IconMic,
  IconRelogio,
  IconRespostaRapida,
  IconVideoCam,
} from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * "ESCOLHA UM BLOCO PARA COMEÇAR": o que este bloco de mensagem vai mandar.
 *
 * No CRM cada formato é um TIPO de bloco (`mensagem_texto`, `mensagem_imagem`, …), e até agora a
 * única forma de escolher o formato era escolher o bloco certo na hora de adicionar — ou seja,
 * decidir antes de abrir. Na referência é o contrário: entra um bloco de "Mensagem" e o formato se
 * escolhe dentro dele, com a lista à vista. É melhor pela razão de sempre: a pergunta "texto ou
 * áudio?" se responde olhando a conversa que está sendo montada, não o menu de blocos.
 *
 * Trocar de formato usa `onTrocarTipo`, que já existia — o mesmo caminho que transforma uma
 * mensagem de texto em pergunta com botões.
 *
 * "Cartões" (o carrossel) não está aqui porque o CRM não tem esse bloco. Desenhar a opção e não
 * entregar o carrossel seria a definição de botão falso, que é o que `canais/capacidades.ts`
 * existe pra impedir.
 *
 * E ELA ABRE FECHADA, mostrando o formato atual numa linha só.
 *
 * Aberta, a lista ocupava quatrocentos e cinquenta pixels no topo do painel e empurrava pra baixo
 * da dobra justamente o que a pessoa foi ali fazer: "quando eu clico em aguardar, o menu lateral
 * não aparece a janelinha de tempo". Aparecia — mas só pra quem rolasse. Trocar o formato é coisa
 * que se faz de vez em quando; configurar o bloco é o que se faz toda vez que ele é aberto.
 */
type Opcao = {
  tipo: FlowNodeType;
  rotulo: string;
  descricao?: string;
  Icone: typeof IconConversas;
  /** O `data` inicial do bloco ao trocar. Vazio = o formulário cuida. */
  dados?: Record<string, unknown>;
};

const OPCOES: Opcao[] = [
  { tipo: "mensagem_texto", rotulo: "Mensagem", descricao: "Texto e botões de ação", Icone: IconConversas },
  { tipo: "mensagem_botoes", rotulo: "Pergunta", descricao: "Pergunta com opções pra pessoa escolher", Icone: IconRespostaRapida },
  { tipo: "aguardar", rotulo: "Aguardar", descricao: "Espera antes da próxima mensagem", Icone: IconRelogio },
  { tipo: "mensagem_audio", rotulo: "Áudio", Icone: IconMic },
  { tipo: "mensagem_imagem", rotulo: "Imagem", Icone: IconImage },
  { tipo: "mensagem_video", rotulo: "Vídeo", Icone: IconVideoCam },
  { tipo: "mensagem_documento", rotulo: "PDF", Icone: IconDoc },
];

export function EscolhaDeConteudo({
  tipoAtual,
  onEscolher,
}: {
  tipoAtual: FlowNodeType;
  onEscolher: (tipo: FlowNodeType, dados: Record<string, unknown>) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [aberta, setAberta] = useState(false);
  // Clicar em qualquer lugar fecha, como todo menu do CRM. Sem isto a lista dos sete formatos
  // ficava aberta no topo do painel enquanto a pessoa trabalhava no bloco embaixo dela.
  const fechar = useCallback(() => setAberta(false), []);
  useFecharMenuDeLinha(aberta, fechar);
  const atual = OPCOES.find((o) => o.tipo === tipoAtual);
  const IconeAtual = atual?.Icone ?? IconConversas;

  return (
    <div className="esc-conteudo" data-menu-de-linha="">
      {/* A linha do formato atual. É ela que abre a lista, e é o cabeçalho do painel inteiro. */}
      <button
        type="button"
        className={`esc-conteudo-atual${aberta ? " aberta" : ""}`}
        aria-expanded={aberta}
        onClick={() => setAberta((v) => !v)}
      >
        <span className="esc-conteudo-icone" aria-hidden="true">
          <IconeAtual width={17} height={17} />
        </span>
        <span className="esc-conteudo-textos">
          <strong>{traduzir(atual?.rotulo ?? "Bloco")}</strong>
          <span>{traduzir(atual?.descricao ?? "Formato deste bloco")}</span>
        </span>
        <span className="esc-conteudo-trocar">{traduzir("Trocar")}</span>
        <IconSetaBaixo className={aberta ? "girado" : undefined} width={14} height={14} aria-hidden="true" />
      </button>

      {aberta ? (
      <div className="esc-conteudo-lista">
        {OPCOES.filter((o) => BLOCOS_DISPONIVEIS.some((b) => b.tipo === o.tipo)).map((o) => (
          <button
            key={o.tipo}
            type="button"
            className={`esc-conteudo-item${o.tipo === tipoAtual ? " on" : ""}`}
            aria-pressed={o.tipo === tipoAtual}
            onClick={() => {
              setAberta(false);
              onEscolher(o.tipo, o.dados ?? {});
            }}
          >
            <span className="esc-conteudo-icone" aria-hidden="true">
              <o.Icone width={17} height={17} />
            </span>
            <span className="esc-conteudo-textos">
              <strong>{traduzir(o.rotulo)}</strong>
              {o.descricao ? <span>{traduzir(o.descricao)}</span> : null}
            </span>
            <span className="esc-conteudo-mais" aria-hidden="true">
              +
            </span>
          </button>
        ))}
      </div>
      ) : null}
    </div>
  );
}
