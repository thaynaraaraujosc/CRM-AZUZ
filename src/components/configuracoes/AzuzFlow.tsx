"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { IconAlerta, IconExpandir } from "@/components/icons";
import { ModalConfirmacao } from "@/components/ui";
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
  /** "Esta empresa usa o AZUZ Flow?" `null` = ninguém respondeu. Ver `azuz-flow-config.ts`. */
  usaFlow: "sim" | "nao" | null;
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

/** Como cada opção do seletor de canal aparece pra quem lê. */
const ROTULOS_DE_CANAL: Record<ConfigDoCanal["canal"], string> = {
  automatico: "Automático (oficial se conectado, senão QR Code)",
  oficial: "Só o WhatsApp oficial",
  qrcode: "Só o WhatsApp QR Code",
};


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
  const [enderecoCopiado, setEnderecoCopiado] = useState(false);
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
  /**
   * O cartão está aberto?
   *
   * Preferência de VISTA, não de conta: guardar isto no servidor faria uma pessoa fechar o cartão
   * e ele amanhecer fechado pra todo mundo da equipe. Quem respondeu "sim" abre direto na primeira
   * vez — acabou de pedir pra configurar — e a setinha manda daí em diante.
   */
  const [aberto, setAberto] = useState(true);

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
      } else setErro(lido.erro);
    } finally {
      setSalvandoCanal(false);
    }
  }

  const data = (valor: string | null | undefined) =>
    valor ? new Date(valor).toLocaleString(localeNumero) : traduzir("nunca");

  /*
   * O AZUZ FLOW NÃO É PRA TODO MUNDO, e a tela precisa saber disso.
   *
   * O Flow é produto de quem tem agência. Quem compra o CRM pra vender o próprio serviço abria
   * Integrações e encontrava endereço do CRM, chave e canal dos leads de uma coisa que nunca ouviu
   * falar — três campos técnicos, sem nada dizendo se aquilo é obrigatório, se está quebrado ou se
   * pode ser ignorado. Esse é o tipo de dúvida que vira mensagem pro suporte.
   *
   * Agora a tela pergunta antes de mostrar. Sem resposta, o cartão é uma linha com a pergunta;
   * "sim" abre a configuração; "não" encolhe pra uma linha quieta.
   */
  const usaFlow = canal?.usaFlow ?? null;

  /** A resposta vai pro servidor: é decisão da EMPRESA, não do navegador de quem respondeu. */
  function responder(resposta: "sim" | "nao" | null) {
    setAberto(true);
    void salvarConfig({ usaFlow: resposta });
  }

  // Ninguém respondeu ainda: só a pergunta, pequena, com as duas saídas.
  if (canal && usaFlow === null) {
    return (
      <div className="config-bloco flow-convite">
        <div className="flow-convite-texto">
          <p className="config-bloco-titulo" style={{ margin: 0 }}>{traduzir("AZUZ Flow")}</p>
          <p className="hint" style={{ margin: 0 }}>
            {traduzir("Você tem conta no AZUZ Flow e quer trazer os leads dele pra cá?")}
          </p>
        </div>
        <div className="flow-convite-acoes">
          <button type="button" className="btn primary" disabled={salvandoCanal} onClick={() => responder("sim")}>
            {traduzir("Sim")}
          </button>
          <button type="button" className="btn ghost" disabled={salvandoCanal} onClick={() => responder("nao")}>
            {traduzir("Não")}
          </button>
        </div>
      </div>
    );
  }

  /*
   * "NÃO" ENCOLHE, E NÃO APAGA.
   *
   * O pedido foi que a opção saísse da tela, e é o que acontece: de um bloco com três campos
   * técnicos pra uma linha. Sumir de vez seria outra coisa — uma escolha sem volta, e quem
   * contratar uma agência depois não teria como achar a integração de novo nem saber que ela
   * existe. A linha é o caminho de volta, e ocupa quase nada.
   */
  if (canal && usaFlow === "nao") {
    return (
      <div className="config-bloco flow-convite flow-convite-recusado">
        <p className="hint" style={{ margin: 0 }}>
          {traduzir("AZUZ Flow: você marcou que não usa.")}
        </p>
        <button type="button" className="btn ghost pequeno" disabled={salvandoCanal} onClick={() => responder(null)}>
          {traduzir("Tenho conta")}
        </button>
      </div>
    );
  }

  return (
    <div className="config-bloco">
      {/* A setinha abre e fecha. Mesmo depois de configurado, isto é um cartão técnico que se
          consulta de vez em quando — deixá-lo aberto pra sempre é ocupar a tela com o que já foi
          resolvido. */}
      <button
        type="button"
        className="flow-cabecalho"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <span className="config-bloco-titulo">{traduzir("AZUZ Flow")}</span>
        <IconExpandir className={aberto ? "girado" : undefined} width={14} height={14} aria-hidden="true" />
      </button>

      {aberto ? (
      <>

      {/*
        A CONEXÃO EM TRÊS LINHAS: endereço, chave, canal.

        Cada linha é rótulo à esquerda e valor à direita, alinhados numa coluna só. Antes eram três
        caixas empilhadas de alturas diferentes, com os botões da chave lá no fim do cartão, longe
        da chave que eles mexem — pareciam botões soltos sem dono.
      */}
      <div className="flow-topo">
        <div className="flow-linha">
          <span className="flow-rotulo-micro">{traduzir("Endereço do CRM")}</span>
          <div className="flow-valor">
            <code className="flow-chave">{ENDERECO_DO_CRM}</code>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(ENDERECO_DO_CRM).then(() => setEnderecoCopiado(true));
              }}
            >
              {enderecoCopiado ? traduzir("Copiado") : traduzir("Copiar")}
            </button>
          </div>
        </div>

        <div className="flow-linha">
          <span className="flow-rotulo-micro">{traduzir("Chave")}</span>
          <div className="flow-valor">
            {estado?.chave ? (
              <>
                <code className="flow-chave">{estado.chave.prefixo}…</code>
                <button type="button" className="btn" disabled={ocupado} onClick={pedirParaGerar}>
                  {traduzir("Gerar nova")}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={ocupado}
                  onClick={() => setConfirmando("revogar")}
                >
                  {traduzir("Revogar")}
                </button>
              </>
            ) : leitura.situacao === "lido" ? (
              <>
                <span className="hint">{traduzir("Nenhuma chave ativa.")}</span>
                <button type="button" className="btn" disabled={ocupado} onClick={pedirParaGerar}>
                  {traduzir("Gerar chave")}
                </button>
              </>
            ) : (
              <span className="hint">
                {leitura.situacao === "lendo" ? traduzir("Lendo…") : traduzir("Estado desconhecido.")}
              </span>
            )}
          </div>
        </div>

        {/* "Último lead" responde a única pergunta que se faz desta tela depois de configurada:
            está chegando? Só aparece quando existe o que contar — "nunca" é ruído com cara de dado. */}
        {estado?.ultimoLeadEm ? (
          <div className="flow-linha">
            <span className="flow-rotulo-micro">{traduzir("Último lead")}</span>
            <div className="flow-valor">
              <span className="flow-texto">{data(estado.ultimoLeadEm)}</span>
            </div>
          </div>
        ) : null}

        {/* Só aparece depois de lido: um seletor que abre em "Automático" antes de saber o que está
            guardado afirma uma escolha que a empresa talvez não tenha feito. */}
        {canal ? (
          <div className="flow-linha">
            <span className="flow-rotulo-micro">{traduzir("Canal dos leads")}</span>
            <div className="flow-valor">
              <select
                className="input flow-select"
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
          </div>
        ) : null}
      </div>

      {chaveNova ? (
        <div className="int-aviso-conflito" style={{ marginBottom: 12 }}>
          <p className="int-title" style={{ margin: 0 }}>{traduzir("Copie agora: esta chave não aparece de novo.")}</p>
          <div className="flow-valor" style={{ marginTop: 8 }}>
            <code className="flow-chave flow-chave-inteira">{chaveNova}</code>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                void navigator.clipboard.writeText(chaveNova).then(() => setCopiada(true));
              }}
            >
              {copiada ? traduzir("Copiada") : traduzir("Copiar chave")}
            </button>
          </div>
        </div>
      ) : null}

      {/*
        AVISO SÓ QUANDO FALTA ALGO. Confirmar o esperado é ruído; o que merece espaço é a exceção,
        porque ela muda o que vai acontecer com o lead. E só com a leitura FEITA: dizer "esta
        empresa não tem funil" a partir de uma leitura que falhou seria inventar um fato sobre a
        conta de um cliente.

        A frase do canal vem do SERVIDOR, da mesma função que a entrega do lead usa
        (`escolherCanalDoFlow`), então a tela e o comportamento não têm como divergir.
      */}
      {leitura.situacao === "lido" && (!leitura.dados.destino || canal?.aviso) ? (
        <div className="flow-aviso">
          {!leitura.dados.destino ? (
            <p>
              <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
              {traduzir("Esta empresa ainda não tem funil: o lead entra como contato, sem card.")}
            </p>
          ) : null}
          {canal?.aviso ? (
            <p>
              <IconAlerta width={12} height={12} aria-hidden="true" /> {traduzir(canal.aviso)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
        A CONFIRMAÇÃO DE REUNIÃO.

        Só aparece com uma chave ativa: sem chave não chega lead, e uma opção que não pode fazer
        efeito ocupando espaço é ruído.

        CADA INTERRUPTOR TEM NOME AO LADO, e o estado por extenso: ligar isto faz o CRM mandar
        mensagem sozinho, pra quem nunca escreveu, por um número que pode ser bloqueado por
        denúncia. O ângulo de uma pílula não distingue "desligada" de "pausada pelo disjuntor".
      */}
      {canal && estado?.chave ? (
        <div className="flow-cartao">
          {canal.disjuntor.pausadoEm ? (
            <div className="int-aviso-conflito" style={{ marginBottom: 14 }}>
              <p className="int-title" style={{ margin: 0 }}>
                <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
                {traduzir("Confirmações pausadas automaticamente.")}
              </p>
              <p className="hint" style={{ margin: "4px 0 8px" }}>
                {traduzir("{falhas} falhas seguidas no envio.", { falhas: String(canal.disjuntor.falhasSeguidas) })}{" "}
                {canal.disjuntor.ultimoMotivo ? traduzir(canal.disjuntor.ultimoMotivo) : null}{" "}
                {traduzir("A fila está guardada e volta a sair quando você religar.")}
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
          ) : null}

          {/*
            * A CONFIRMAÇÃO DE REUNIÃO MUDOU DE CASA, em 03/11/2026.
            *
            * Ela morava aqui — ligar, o texto, as variáveis, as proteções e a pausa —, e aqui é o
            * lugar onde se CONECTA uma integração: gerar a chave, revogar, ver o endereço. O que
            * acontece quando alguém preenche um formulário não é conexão, é automação; e era uma
            * configuração só para TODOS os formulários, quando cada um pede uma resposta diferente.
            *
            * Agora é por formulário, em Automações › Formulários do Flow. A regra geral continua
            * existindo por baixo (o formulário sem regra própria a segue), mas quem a edita é
            * aquela tela — duas telas para a mesma configuração é como se cria o caso em que uma
            * diz uma coisa e o CRM faz outra.
            */}
          <p className="hint">
            {traduzir("A confirmação de reunião e a mensagem de cada formulário ficam em")}{" "}
            <a href="/automacoes/formularios">{traduzir("Automações › Formulários do Flow")}</a>.
          </p>
        </div>
      ) : null}

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
      </>
      ) : null}
    </div>
  );
}
