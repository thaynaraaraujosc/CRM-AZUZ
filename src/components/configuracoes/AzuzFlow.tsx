"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { IconAlerta } from "@/components/icons";
import { ModalConfirmacao, Toggle } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";
import { lerJson } from "@/lib/ler-resposta";
import { precisaConfirmarAntesDeGerar } from "@/lib/integracoes/estado-do-cartao";

type Estado = {
  chave: { prefixo: string; criadaEm: string; criadaPor: string; ultimoUsoEm: string | null } | null;
  whatsappOficialConectado: boolean;
  destino: { funil: string; etapa: string } | null;
  ultimoLeadEm: string | null;
};

/** O endereço que a agência cola no Flow. Fixo porque o Flow já aponta pra cá; não é configurável
 *  dos dois lados, senão as duas pontas podem divergir e ninguém descobre até o lead sumir. */
const ENDERECO_DO_CRM = "https://azuzcrm.com.br";

/**
 * O cartão do AZUZ Flow em Configurações › Integrações.
 *
 * A chave aparece UMA vez, no momento em que é gerada, e o aviso disso precisa estar na tela antes
 * de a pessoa fechar o modal — não é escolha de design, é a consequência de guardarmos só o hash.
 * Quem fechar sem copiar tem que gerar outra, e gerar outra derruba a anterior.
 */
/**
 * Três situações, não duas.
 *
 * Com `Estado | null`, "ainda não li" e "não consegui ler" viravam a mesma coisa na tela — e o
 * cartão então AFIRMAVA, a partir de um `null`, que a empresa não tem funil, que o WhatsApp não
 * está conectado e que não há chave ativa. Nenhuma das três tinha sido lida. Em 14/10/2026 foi
 * exatamente o que apareceu em produção: três frases inventadas sobre o estado de um cliente.
 *
 * Pior: `gerar()` só pede confirmação quando enxerga uma chave existente. Com a leitura falhando
 * ele não enxergava nenhuma, e o botão passava a revogar a chave em uso sem perguntar nada.
 */
/** O que a rota de opções devolve: a escolha guardada E o que ela significa agora. */
type ConfigDoCanal = {
  canal: "automatico" | "oficial" | "qrcode";
  conexoes: { oficial: boolean; qrcode: boolean };
  /** A conexão que o próximo lead vai usar de verdade. `null` = nenhuma serve. */
  conexaoEfetiva: "oficial" | "qrcode" | null;
  aviso: string | null;
  confirmacao: {
    ativa: boolean;
    texto: string;
    pausada: boolean;
    janela: { inicio: string; fim: string };
    tetoDiario: number;
    tetoPorNumero: number;
    falhasParaPausar: number;
  };
  /** O que está acontecendo com o canal agora. Não é escolha da empresa — ver o disjuntor. */
  disjuntor: { falhasSeguidas: number; pausadoEm: string | null; ultimoMotivo: string | null };
};

/** O que cada variável vale, pra listar embaixo do campo. Copiado da lista do servidor em vez de
 *  importado: é texto de tela, e importar puxaria o módulo de fuso horário pro navegador à toa. */
const VARIAVEIS_DA_CONFIRMACAO: [string, string][] = [
  ["{{primeiroNome}}", "o primeiro nome de quem preencheu"],
  ["{{data}}", "a data por extenso"],
  ["{{dataCurta}}", "a data em números"],
  ["{{hora}}", "a hora em Brasília"],
  // Curta pra caber numa linha da grade; a frase inteira está no `title` do botão.
  ["{{link}}", "o link da reunião"],
  ["{{empresa}}", "o nome da sua empresa"],
];

/** O que o `title` conta além do rótulo curto. Só onde a explicação curta deixa algo de fora. */
const DETALHE_DA_VARIAVEL: Record<string, string> = {
  "{{link}}": "O link da reunião. Sozinho numa linha, a linha inteira some quando não houver link.",
};

const ROTULOS_DE_CANAL: Record<ConfigDoCanal["canal"], string> = {
  automatico: "Automático (oficial se conectado, senão QR Code)",
  oficial: "Só o WhatsApp oficial",
  qrcode: "Só o WhatsApp QR Code",
};

/** O que a tela edita antes de mandar salvar. Tudo texto: campo de número guarda o que foi
 *  digitado, e converter na hora de salvar é o que permite apagar e redigitar sem o campo pular. */
type Protecoes = {
  inicio: string;
  fim: string;
  tetoDiario: string;
  tetoPorNumero: string;
  falhasParaPausar: string;
};

function protecoesDe(c: ConfigDoCanal): Protecoes {
  return {
    inicio: c.confirmacao.janela.inicio,
    fim: c.confirmacao.janela.fim,
    tetoDiario: String(c.confirmacao.tetoDiario),
    tetoPorNumero: String(c.confirmacao.tetoPorNumero),
    falhasParaPausar: String(c.confirmacao.falhasParaPausar),
  };
}

/** Mudou algo em relação ao que está guardado? Compara como TEXTO: "30" e "030" são o mesmo
 *  limite, e oferecer "Salvar" por causa de um zero à esquerda é oferecer trabalho inútil. */
function protecoesMudaram(c: ConfigDoCanal, p: Protecoes): boolean {
  const guardado = protecoesDe(c);
  return (
    guardado.inicio !== p.inicio ||
    guardado.fim !== p.fim ||
    guardado.tetoDiario !== String(Number(p.tetoDiario)) ||
    guardado.tetoPorNumero !== String(Number(p.tetoPorNumero)) ||
    guardado.falhasParaPausar !== String(Number(p.falhasParaPausar))
  );
}

/**
 * O que chegou da rota, com o estado do canal garantido.
 *
 * A rota responde o recurso inteiro no GET e no PUT (ver `azuz-flow-resposta.ts`), e é dela a
 * obrigação. Isto aqui é cinto de segurança: um corpo sem `disjuntor` derrubava a tela INTEIRA de
 * Configurações em "Algo deu errado por aqui", porque o render lê `canal.disjuntor.pausadoEm`. Um
 * campo faltando pode esconder um aviso; não pode apagar a tela.
 */
function comEstadoCompleto(dados: ConfigDoCanal): ConfigDoCanal {
  return {
    ...dados,
    disjuntor: dados.disjuntor ?? { falhasSeguidas: 0, pausadoEm: null, ultimoMotivo: null },
  };
}

type Leitura =
  | { situacao: "lendo" }
  | { situacao: "lido"; dados: Estado }
  | { situacao: "falhou"; motivo: string };

export function AzuzFlow() {
  const { t: traduzir, localeNumero } = useIdioma();
  const { data: sessao } = useSession();
  const [leitura, setLeitura] = useState<Leitura>({ situacao: "lendo" });
  const [chaveNova, setChaveNova] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Qual confirmação está aberta. `null` = nenhuma. Substitui o `window.confirm` do navegador. */
  const [confirmando, setConfirmando] = useState<"gerar" | "revogar" | null>(null);
  /**
   * Por qual conexão o lead do Flow ganha conversa.
   *
   * `null` enquanto não foi lido: o seletor não pode mostrar "Automático" por padrão e dar a
   * entender que foi isso que a empresa escolheu, quando na verdade ainda não se sabe.
   */
  const [canal, setCanal] = useState<ConfigDoCanal | null>(null);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  /** O texto em edição. Separado de `canal.confirmacao.texto` porque digitar não pode salvar a
   *  cada tecla: seriam dezenas de gravações por frase. */
  const [textoEmEdicao, setTextoEmEdicao] = useState<string | null>(null);
  /** As proteções em edição, pelo mesmo motivo do texto: horário e teto se digitam dígito a
   *  dígito, e salvar a cada tecla gravaria "0", "3", "30" — sendo que "0" é recusado. */
  const [protecoes, setProtecoes] = useState<Protecoes | null>(null);
  /** O campo do texto, pra variável clicada entrar onde o cursor estava. */
  const areaDoTexto = useRef<HTMLTextAreaElement>(null);

  const ehAdmin = sessao?.user?.papelTipo === "admin" || sessao?.user?.superAdmin;

  useEffect(() => {
    if (!ehAdmin) return;
    // O erro do servidor aparece no cartão desde o primeiro carregamento. Antes um 500 aqui virava
    // `setEstado(null)`, que na tela é indistinguível de "ainda não tem chave": a pessoa clicava em
    // "Gerar chave" sem saber que o estado nunca tinha sido lido.
    void (async () => {
      const r = await fetch("/api/integracoes/azuz-flow/chave").catch(() => null);
      if (!r) {
        setLeitura({
          situacao: "falhou",
          motivo: traduzir("Não deu pra ler o estado da integração. Confira a conexão e recarregue."),
        });
        return;
      }
      const lido = await lerJson<Estado>(r, traduzir("Não deu pra ler o estado da integração."));
      setLeitura(lido.ok ? { situacao: "lido", dados: lido.dados } : { situacao: "falhou", motivo: lido.erro });
    })();

    /*
     * As opções vêm numa chamada à parte, de propósito.
     *
     * Falhar ao ler o canal não pode esconder a chave, nem o contrário: são duas informações
     * independentes, e juntá-las numa chamada só faria um erro em qualquer uma apagar as duas da
     * tela. O seletor fica simplesmente ausente enquanto não for lido.
     */
    void (async () => {
      const r = await fetch("/api/integracoes/azuz-flow/config").catch(() => null);
      if (!r?.ok) return;
      const lido = await lerJson<ConfigDoCanal>(r, "");
      if (lido.ok) {
        const completo = comEstadoCompleto(lido.dados);
        setCanal(completo);
        setTextoEmEdicao(completo.confirmacao.texto);
        setProtecoes(protecoesDe(completo));
      }
    })();
    // `traduzir` muda com o idioma; reler o estado por troca de idioma não faria mal, mas também
    // não faz falta — o que importa é rodar quando a pessoa é admin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdmin]);

  // Chave de integração é do mesmo peso que conectar um canal: quem não administra a conta não vê
  // nem o estado dela.
  if (!ehAdmin) return null;

  // O que a tela sabe de verdade. `undefined` quer dizer "não sei", nunca "não tem".
  const estado = leitura.situacao === "lido" ? leitura.dados : undefined;
  // Erro de ação tem prioridade: é o que a pessoa acabou de provocar.
  const mensagemDeErro = erro ?? (leitura.situacao === "falhou" ? leitura.motivo : null);

  async function recarregar() {
    const r = await fetch("/api/integracoes/azuz-flow/chave");
    const lido = await lerJson<Estado>(r, traduzir("Não deu pra ler o estado da integração."));
    if (!lido.ok) {
      setLeitura({ situacao: "falhou", motivo: lido.erro });
      throw new Error(lido.erro);
    }
    setLeitura({ situacao: "lido", dados: lido.dados });
  }

  /** Pede confirmação quando há chave em uso — ou quando não se sabe se há. */
  function pedirParaGerar() {
    const confirmar = precisaConfirmarAntesDeGerar(
      leitura.situacao,
      leitura.situacao === "lido" && Boolean(leitura.dados.chave),
    );
    if (confirmar) setConfirmando("gerar");
    else void gerar();
  }

  async function gerar() {
    setConfirmando(null);
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/integracoes/azuz-flow/chave", { method: "POST" });
      const lido = await lerJson<{ chave?: string }>(r, traduzir("Não deu pra gerar a chave."));
      if (!lido.ok) throw new Error(lido.erro);
      if (!lido.dados.chave) throw new Error(traduzir("Não deu pra gerar a chave."));
      setChaveNova(lido.dados.chave);
      setCopiada(false);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Não deu pra gerar a chave."));
    } finally {
      setOcupado(false);
    }
  }

  async function revogar() {
    setConfirmando(null);
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/integracoes/azuz-flow/chave", { method: "DELETE" });
      const lido = await lerJson<{ ok: boolean }>(r, traduzir("Não deu pra revogar a chave."));
      if (!lido.ok) throw new Error(lido.erro);
      setChaveNova(null);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Não deu pra revogar a chave."));
    } finally {
      setOcupado(false);
    }
  }

  /** Salva o que mudou. Serve pro canal e pra confirmação: a rota mescla campo a campo. */
  async function salvarConfig(mudancas: Record<string, unknown>) {
    setSalvandoCanal(true);
    setErro(null);
    try {
      const r = await fetch("/api/integracoes/azuz-flow/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mudancas),
      });
      const lido = await lerJson<ConfigDoCanal>(r, traduzir("Não deu pra salvar."));
      if (lido.ok) {
        const completo = comEstadoCompleto(lido.dados);
        setCanal(completo);
        setTextoEmEdicao(completo.confirmacao.texto);
        setProtecoes(protecoesDe(completo));
      } else setErro(lido.erro);
    } finally {
      setSalvandoCanal(false);
    }
  }

  const data = (valor: string | null | undefined) =>
    valor ? new Date(valor).toLocaleString(localeNumero) : traduzir("nunca");

  /**
   * Põe a variável onde o cursor estava, não no fim.
   *
   * Quem clica em `{{hora}}` está escrevendo uma frase e quer a variável ali, no meio dela. Jogar
   * no fim do texto obrigaria a recortar e colar toda vez — e aí a lista vira enfeite.
   */
  function inserirVariavel(chave: string) {
    const atual = textoEmEdicao ?? "";
    const area = areaDoTexto.current;
    const inicio = area?.selectionStart ?? atual.length;
    const fim = area?.selectionEnd ?? inicio;
    const novo = atual.slice(0, inicio) + chave + atual.slice(fim);
    // O limite é do servidor (2000). Truncar em silêncio apagaria o fim do texto de alguém.
    if (novo.length > 2000) return;
    setTextoEmEdicao(novo);
    if (!area) return;
    // Depois do React reescrever o valor: sem isso o cursor volta pro começo do campo.
    requestAnimationFrame(() => {
      area.focus();
      const posicao = inicio + chave.length;
      area.setSelectionRange(posicao, posicao);
    });
  }

  /**
   * O estado da confirmação em uma palavra, do mais grave pro mais comum.
   *
   * A ordem importa: pausada pelo disjuntor é diferente de pausada por decisão, e as duas são
   * diferentes de desligada. O ângulo de um interruptor não diz qual das três é.
   */
  const situacao = !canal
    ? { texto: "Desligada", cor: "badge-neutral" }
    : canal.disjuntor.pausadoEm
      ? { texto: "Pausada automaticamente", cor: "badge-danger" }
      : !canal.confirmacao.ativa
        ? { texto: "Desligada", cor: "badge-neutral" }
        : canal.confirmacao.pausada
          ? { texto: "Pausada", cor: "badge-warning" }
          : { texto: "Ligada", cor: "badge-success" };

  return (
    <div className="config-bloco">
      <p className="config-bloco-titulo">{traduzir("AZUZ Flow")}</p>

      <div className="field">
        <label>{traduzir("Endereço do CRM (cole no AZUZ Flow)")}</label>
        <input className="input" style={{ width: "100%" }} readOnly value={ENDERECO_DO_CRM} />
      </div>

      {chaveNova ? (
        <div className="int-aviso-conflito" style={{ marginBottom: 12 }}>
          <p className="int-title" style={{ margin: 0 }}>{traduzir("Copie agora: esta chave não aparece de novo.")}</p>
          <p className="hint" style={{ margin: "4px 0 8px" }}>
            {traduzir("O CRM guarda só um resumo dela. Perdeu, é só gerar outra — mas a atual para de funcionar.")}
          </p>
          <input className="input" style={{ width: "100%", fontFamily: "monospace" }} readOnly value={chaveNova} />
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 8 }}
            onClick={() => {
              void navigator.clipboard.writeText(chaveNova).then(() => setCopiada(true));
            }}
          >
            {copiada ? traduzir("Copiada") : traduzir("Copiar chave")}
          </button>
        </div>
      ) : null}

      {estado?.chave ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <p className="int-title" style={{ margin: 0 }}>
            {traduzir("Chave ativa: {prefixo}…", { prefixo: estado.chave.prefixo })}
          </p>
          <p className="hint" style={{ margin: "4px 0 0" }}>
            {traduzir("Criada em {quando} por {quem}", {
              quando: data(estado.chave.criadaEm),
              quem: estado.chave.criadaPor,
            })}
          </p>
          {/* "nunca" não é informação: é ruído com cara de dado. Estas duas linhas só aparecem
              depois que existe o que contar. */}
          {estado.ultimoLeadEm ? (
            <p className="hint" style={{ margin: "2px 0 0" }}>
              {traduzir("Último lead recebido: {quando}", { quando: data(estado.ultimoLeadEm) })}
            </p>
          ) : null}
        </div>
      ) : leitura.situacao === "lido" ? (
        <p className="hint" style={{ margin: "0 0 12px" }}>{traduzir("Nenhuma chave ativa.")}</p>
      ) : (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          {leitura.situacao === "lendo" ? traduzir("Lendo o estado da integração…") : traduzir("Estado desconhecido.")}
        </p>
      )}

      {/*
        AVISO SÓ QUANDO FALTA ALGO.

        Antes esta caixa aparecia sempre, e na maior parte do tempo ela dizia que estava tudo certo —
        que é a informação menos útil que existe numa tela. Confirmar o esperado é ruído; o que
        merece espaço é a exceção, porque ela muda o que vai acontecer com o lead.

        Continua só aparecendo com a leitura FEITA: dizer "esta empresa não tem funil" a partir de
        uma leitura que falhou seria inventar um fato sobre a conta de um cliente.
      */}
      {/*
        POR QUAL NÚMERO O LEAD É ATENDIDO.
        
        Só aparece depois de lido: um seletor que abre em "Automático" antes de saber o que está
        guardado afirma uma escolha que a empresa talvez não tenha feito.
      */}
      {canal ? (
        <div className="field">
          <label>{traduzir("Canal que recebe os leads do Flow")}</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={canal.canal}
            disabled={salvandoCanal}
            onChange={(e) => void salvarConfig({ canal: e.target.value })}
          >
            {(Object.keys(ROTULOS_DE_CANAL) as ConfigDoCanal["canal"][]).map((opcao) => (
              <option key={opcao} value={opcao}>
                {traduzir(ROTULOS_DE_CANAL[opcao])}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/*
        A CONFIRMAÇÃO DE REUNIÃO.

        Só aparece com uma chave ativa: sem chave não chega lead, e uma opção que não pode fazer
        efeito ocupando espaço é ruído.

        CADA INTERRUPTOR TEM NOME AO LADO. Eram duas pílulas iguais flutuando sobre parágrafos
        cinza — o `Toggle` só leva `aria-label`, que ninguém vê. Dois controles sem rótulo, um
        deles capaz de fazer o CRM mandar mensagem sozinho pra gente de verdade.

        O AVISO EMBAIXO DO INTERRUPTOR não é texto de rodapé. Ligar isto faz o CRM mandar mensagem
        sozinho, pra quem nunca escreveu, por um número que pode ser bloqueado por denúncia. Quem
        liga precisa ler isso antes, não depois.
      */}
      {canal && estado?.chave ? (
        <div className="card" style={{ marginBottom: 12 }}>
          {/*
            O DISJUNTOR VEM PRIMEIRO, antes de qualquer opção.

            Se o canal está pausado, nada que a pessoa mexer aqui embaixo vai mandar mensagem — e
            descobrir isso depois de ajustar texto e teto é a pior ordem possível. A frase diz o
            motivo e o botão desfaz, no mesmo lugar.
          */}
          {canal.disjuntor.pausadoEm ? (
            <div className="flow-bloco">
              <div className="int-aviso-conflito">
                <p className="int-title" style={{ margin: 0 }}>
                  <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
                  {traduzir("As confirmações foram pausadas automaticamente.")}
                </p>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  {traduzir("Foram {falhas} falhas seguidas no envio, em {quando}.", {
                    falhas: String(canal.disjuntor.falhasSeguidas),
                    quando: data(canal.disjuntor.pausadoEm),
                  })}{" "}
                  {canal.disjuntor.ultimoMotivo
                    ? traduzir("Último motivo: {motivo}.", { motivo: canal.disjuntor.ultimoMotivo })
                    : null}
                </p>
                <p className="hint" style={{ margin: "4px 0 10px" }}>
                  {traduzir(
                    "Nada foi perdido: as confirmações continuam na fila e voltam a sair quando você religar.",
                  )}
                </p>
                <button
                  type="button"
                  className="btn"
                  disabled={salvandoCanal}
                  onClick={() => void salvarConfig({ religar: true })}
                >
                  {salvandoCanal ? traduzir("Religando…") : traduzir("Religar")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flow-interruptor">
            <div>
              <div className="flow-rotulo">
                {traduzir("Confirmação de reunião do Flow")}
                {/* O estado por extenso, ao lado do nome. O ângulo de uma pílula é a pior forma de
                    dizer se o CRM está mandando mensagem sozinho ou não. */}
                <span className={`badge ${situacao.cor}`}>{traduzir(situacao.texto)}</span>
              </div>
              <p className="hint">
                {traduzir(
                  "Quando o lead marca reunião no formulário, o CRM manda UMA mensagem confirmando dia, hora e link — só para quem marcou a caixa de consentimento.",
                )}
              </p>
            </div>
            <Toggle
              label={traduzir("Confirmação de reunião do Flow")}
              defaultOn={canal.confirmacao.ativa}
              onToggle={(ligado) => void salvarConfig({ confirmacao: { ativa: ligado } })}
            />
          </div>

          <div className="flow-bloco">
            <p className="flow-bloco-titulo">{traduzir("Mensagem")}</p>
            <textarea
              ref={areaDoTexto}
              className="input flow-area"
              value={textoEmEdicao ?? ""}
              maxLength={2000}
              onChange={(e) => setTextoEmEdicao(e.target.value)}
            />
            <span className="flow-contagem">
              {(textoEmEdicao ?? "").length}/2000
            </span>

            {/* As variáveis como botões, não como lista de documentação: clicar põe a variável no
                ponto onde o cursor estava, que é a única coisa que alguém quer fazer com elas. */}
            <div className="flow-vars">
              {VARIAVEIS_DA_CONFIRMACAO.map(([chave, explicacao]) => (
                <button
                  key={chave}
                  type="button"
                  className="flow-var"
                  title={
                    DETALHE_DA_VARIAVEL[chave]
                      ? `${traduzir(DETALHE_DA_VARIAVEL[chave])} · ${traduzir("Clique para inserir no texto")}`
                      : traduzir("Clique para inserir no texto")
                  }
                  onClick={() => inserirVariavel(chave)}
                >
                  <code>{chave}</code>
                  <span>{traduzir(explicacao)}</span>
                </button>
              ))}
            </div>

            {textoEmEdicao !== canal.confirmacao.texto ? (
              <div className="flow-salvar">
                <button
                  type="button"
                  className="btn primary"
                  disabled={salvandoCanal}
                  onClick={() => void salvarConfig({ confirmacao: { texto: textoEmEdicao ?? "" } })}
                >
                  {salvandoCanal ? traduzir("Salvando…") : traduzir("Salvar texto")}
                </button>
                <span className="hint">{traduzir("Alterações não salvas.")}</span>
              </div>
            ) : null}
          </div>

          {/*
            AS PROTEÇÕES DO NÚMERO.

            Ficam à mostra, e não escondidas atrás de "avançado", porque são elas que decidem se
            este recurso é seguro de usar. Quem liga a confirmação precisa poder ver, no mesmo
            lugar, o que impede o CRM de mandar cem mensagens de madrugada por um número que pode
            ser bloqueado por denúncia.
          */}
          <div className="flow-interruptor">
            <div>
              <div className="flow-rotulo">{traduzir("Pausar confirmações do Flow")}</div>
              <p className="hint">
                {traduzir(
                  "O freio de mão: para o envio agora e não apaga nada. A fila espera; nada é descartado.",
                )}
              </p>
            </div>
            <Toggle
              label={traduzir("Pausar confirmações do Flow")}
              defaultOn={canal.confirmacao.pausada}
              onToggle={(ligado) => void salvarConfig({ confirmacao: { pausada: ligado } })}
            />
          </div>

          {protecoes ? (
            <div className="flow-bloco">
              <p className="flow-bloco-titulo">{traduzir("Proteções do número")}</p>

              <div className="flow-campos">
                <div className="flow-campo">
                  <label htmlFor="flow-janela-inicio">{traduzir("Enviar a partir de")}</label>
                  <input
                    id="flow-janela-inicio"
                    className="input"
                    type="time"
                    value={protecoes.inicio}
                    onChange={(e) => setProtecoes({ ...protecoes, inicio: e.target.value })}
                  />
                </div>
                <div className="flow-campo">
                  <label htmlFor="flow-janela-fim">{traduzir("até")}</label>
                  <input
                    id="flow-janela-fim"
                    className="input"
                    type="time"
                    value={protecoes.fim}
                    onChange={(e) => setProtecoes({ ...protecoes, fim: e.target.value })}
                  />
                </div>
              </div>
              <p className="hint">
                {traduzir(
                  "Horário de Brasília. Fora da janela a confirmação espera a janela abrir — e nunca sai depois de a reunião começar.",
                )}
              </p>

              <div className="flow-campos" style={{ marginTop: 16 }}>
                <div className="flow-campo">
                  <label htmlFor="flow-teto-dia">{traduzir("Máximo por dia")}</label>
                  <input
                    id="flow-teto-dia"
                    className="input"
                    type="number"
                    min={1}
                    max={500}
                    value={protecoes.tetoDiario}
                    onChange={(e) => setProtecoes({ ...protecoes, tetoDiario: e.target.value })}
                  />
                </div>
                <div className="flow-campo">
                  <label htmlFor="flow-teto-numero">{traduzir("Máximo por número em 24h")}</label>
                  <input
                    id="flow-teto-numero"
                    className="input"
                    type="number"
                    min={1}
                    max={20}
                    value={protecoes.tetoPorNumero}
                    onChange={(e) => setProtecoes({ ...protecoes, tetoPorNumero: e.target.value })}
                  />
                </div>
                <div className="flow-campo">
                  <label htmlFor="flow-falhas">{traduzir("Falhas até pausar")}</label>
                  <input
                    id="flow-falhas"
                    className="input"
                    type="number"
                    min={1}
                    max={50}
                    value={protecoes.falhasParaPausar}
                    onChange={(e) => setProtecoes({ ...protecoes, falhasParaPausar: e.target.value })}
                  />
                </div>
              </div>

              <p className="hint">
                {traduzir(
                  "Depois de {falhas} falhas seguidas no envio, o CRM pausa sozinho e avisa quem administra. Nada é descartado.",
                  { falhas: protecoes.falhasParaPausar || "0" },
                )}
              </p>

              {protecoesMudaram(canal, protecoes) ? (
                <div className="flow-salvar">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={salvandoCanal}
                    onClick={() =>
                      void salvarConfig({
                        confirmacao: {
                          janela: { inicio: protecoes.inicio, fim: protecoes.fim },
                          // `Number("")` é 0, que a rota recusa com a frase certa. Mandar o que foi
                          // digitado, e deixar o servidor julgar, é o que faz a tela e o banco
                          // concordarem sobre o que é um limite válido.
                          tetoDiario: Number(protecoes.tetoDiario),
                          tetoPorNumero: Number(protecoes.tetoPorNumero),
                          falhasParaPausar: Number(protecoes.falhasParaPausar),
                        },
                      })
                    }
                  >
                    {salvandoCanal ? traduzir("Salvando…") : traduzir("Salvar proteções")}
                  </button>
                  <span className="hint">{traduzir("Alterações não salvas.")}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        O AVISO VEM DO SERVIDOR, não de um palpite da tela.
        
        Antes ele era "WhatsApp oficial não conectado", escrito a partir de um booleano — e isso
        passou a ser MENTIRA no dia em que o lead passou a poder cair no QR Code: com o QR ligado e
        a opção em Automático, o lead ganha conversa normalmente e a tela continuava alarmando.
        
        Quem decide é a mesma função que a entrega do lead usa (`escolherCanalDoFlow`), então a
        frase aqui e o comportamento lá não têm como divergir.
      */}
      {leitura.situacao === "lido" && (!leitura.dados.destino || canal?.aviso) ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          {!leitura.dados.destino ? (
            <p className="hint" style={{ margin: 0 }}>
              <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
              {traduzir("Esta empresa ainda não tem funil: o lead entra como contato, sem card.")}
            </p>
          ) : null}
          {canal?.aviso ? (
            <p className="hint" style={{ margin: leitura.dados.destino ? 0 : "4px 0 0" }}>
              <IconAlerta width={12} height={12} aria-hidden="true" /> {traduzir(canal.aviso)}{" "}
              {traduzir("Sem conversa, a automação não tem por onde responder.")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={ocupado} onClick={pedirParaGerar}>
          {estado?.chave ? traduzir("Gerar nova chave") : traduzir("Gerar chave")}
        </button>
        {estado?.chave ? (
          <button type="button" className="btn danger" disabled={ocupado} onClick={() => setConfirmando("revogar")}>
            {traduzir("Revogar")}
          </button>
        ) : null}
      </div>

      <ModalConfirmacao
        aberto={confirmando === "gerar"}
        titulo={traduzir("Gerar uma chave nova?")}
        mensagem={traduzir(
          "A chave atual para de funcionar na hora. O AZUZ Flow vai precisar da chave nova pra continuar entregando leads.",
        )}
        rotuloConfirmar={traduzir("Gerar nova chave")}
        onConfirmar={() => void gerar()}
        onCancelar={() => setConfirmando(null)}
      />

      <ModalConfirmacao
        aberto={confirmando === "revogar"}
        titulo={traduzir("Revogar a chave?")}
        mensagem={traduzir("O AZUZ Flow para de entregar leads neste CRM imediatamente.")}
        rotuloConfirmar={traduzir("Revogar")}
        perigoso
        onConfirmar={() => void revogar()}
        onCancelar={() => setConfirmando(null)}
      />

      {mensagemDeErro ? (
        <p className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>
          {/* Passa pelo dicionário: a frase pode ter vindo do servidor, em português, e as do
              catálogo têm tradução. Chave ausente degrada pro português, como em todo o resto. */}
          <IconAlerta width={12} height={12} aria-hidden="true" /> {traduzir(mensagemDeErro)}
        </p>
      ) : null}
    </div>
  );
}
