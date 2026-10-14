"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { IconAlerta } from "@/components/icons";
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

  const data = (valor: string | null | undefined) =>
    valor ? new Date(valor).toLocaleString(localeNumero) : traduzir("nunca");

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
      {leitura.situacao === "lido" && (!leitura.dados.destino || !leitura.dados.whatsappOficialConectado) ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          {!leitura.dados.destino ? (
            <p className="hint" style={{ margin: 0 }}>
              <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
              {traduzir("Esta empresa ainda não tem funil: o lead entra como contato, sem card.")}
            </p>
          ) : null}
          {!leitura.dados.whatsappOficialConectado ? (
            <p className="hint" style={{ margin: leitura.dados.destino ? 0 : "4px 0 0" }}>
              <IconAlerta width={12} height={12} aria-hidden="true" />{" "}
              {traduzir("WhatsApp oficial não conectado: o lead entra, mas sem conversa pra automação responder.")}
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
