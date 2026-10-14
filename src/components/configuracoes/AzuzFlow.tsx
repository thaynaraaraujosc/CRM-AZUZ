"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { IconAlerta } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";
import { lerJson } from "@/lib/ler-resposta";

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
export function AzuzFlow() {
  const { t: traduzir, localeNumero } = useIdioma();
  const { data: sessao } = useSession();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [chaveNova, setChaveNova] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehAdmin = sessao?.user?.papelTipo === "admin" || sessao?.user?.superAdmin;

  useEffect(() => {
    if (!ehAdmin) return;
    // O erro do servidor aparece no cartão desde o primeiro carregamento. Antes um 500 aqui virava
    // `setEstado(null)`, que na tela é indistinguível de "ainda não tem chave": a pessoa clicava em
    // "Gerar chave" sem saber que o estado nunca tinha sido lido.
    void (async () => {
      const r = await fetch("/api/integracoes/azuz-flow/chave").catch(() => null);
      if (!r) {
        setErro(traduzir("Não deu pra ler o estado da integração. Confira a conexão e recarregue."));
        return;
      }
      const lido = await lerJson<Estado>(r, traduzir("Não deu pra ler o estado da integração."));
      if (lido.ok) setEstado(lido.dados);
      else setErro(lido.erro);
    })();
    // `traduzir` muda com o idioma; reler o estado por troca de idioma não faria mal, mas também
    // não faz falta — o que importa é rodar quando a pessoa é admin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdmin]);

  // Chave de integração é do mesmo peso que conectar um canal: quem não administra a conta não vê
  // nem o estado dela.
  if (!ehAdmin) return null;

  async function recarregar() {
    const r = await fetch("/api/integracoes/azuz-flow/chave");
    const lido = await lerJson<Estado>(r, traduzir("Não deu pra ler o estado da integração."));
    if (!lido.ok) throw new Error(lido.erro);
    setEstado(lido.dados);
  }

  async function gerar() {
    if (
      estado?.chave &&
      !window.confirm(
        traduzir("Gerar uma chave nova faz a atual parar de funcionar na hora. O AZUZ Flow vai precisar da chave nova pra continuar entregando leads. Continuar?"),
      )
    ) {
      return;
    }
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
    if (
      !window.confirm(
        traduzir("Revogar a chave faz o AZUZ Flow parar de entregar leads neste CRM imediatamente. Continuar?"),
      )
    ) {
      return;
    }
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
      <p className="hint" style={{ margin: "0 0 12px" }}>
        {traduzir(
          "Recebe no CRM os leads dos formulários do AZUZ Flow: o contato entra, a conversa de WhatsApp é criada e as automações disparam.",
        )}
      </p>

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
          <p className="hint" style={{ margin: "2px 0 0" }}>
            {traduzir("Último uso: {quando}", { quando: data(estado.chave.ultimoUsoEm) })}
          </p>
          <p className="hint" style={{ margin: "2px 0 0" }}>
            {traduzir("Último lead recebido: {quando}", { quando: data(estado?.ultimoLeadEm) })}
          </p>
        </div>
      ) : (
        <p className="hint" style={{ margin: "0 0 12px" }}>{traduzir("Nenhuma chave ativa.")}</p>
      )}

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          {estado?.destino
            ? traduzir("O lead entra em {funil} › {etapa}.", {
                funil: estado.destino.funil,
                etapa: estado.destino.etapa,
              })
            : traduzir("Esta empresa ainda não tem funil: o lead entra como contato, sem card.")}
        </p>
        <p className="hint" style={{ margin: "4px 0 0" }}>
          {estado?.whatsappOficialConectado
            ? traduzir("WhatsApp oficial conectado: a conversa é criada junto com o lead.")
            : traduzir("WhatsApp oficial não conectado: o lead entra, mas sem conversa pra automação responder.")}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={ocupado} onClick={() => void gerar()}>
          {estado?.chave ? traduzir("Gerar nova chave") : traduzir("Gerar chave")}
        </button>
        {estado?.chave ? (
          <button type="button" className="btn danger" disabled={ocupado} onClick={() => void revogar()}>
            {traduzir("Revogar")}
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", marginTop: 8 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
        </p>
      ) : null}
    </div>
  );
}
