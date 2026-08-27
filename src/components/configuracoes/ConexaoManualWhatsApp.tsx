"use client";

import { useState } from "react";

/**
 * Conexão direta de uma conta do WhatsApp Business que JÁ existe no Business Manager da pessoa.
 *
 * É a alternativa ao Embedded Signup: aquele fluxo serve pra CRIAR a conta de um cliente de dentro
 * do CRM e exige que o app esteja aprovado como Provedor de Tecnologia pela Meta (dias de análise).
 * Quem já tem a WABA criada e aprovada não precisa de nada disso — só de um token permanente.
 *
 * O token é digitado uma única vez, vai pro servidor e sai criptografado pro banco. Nenhuma rota
 * devolve ele de volta, então o campo nunca é preenchido de novo com o valor salvo.
 */
export function ConexaoManualWhatsApp({ aoConectar }: { aoConectar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [pinExistente, setPinExistente] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dica, setDica] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [pinPendente, setPinPendente] = useState(false);

  async function conectar() {
    setEnviando(true);
    setErro(null);
    setDica(null);
    try {
      const resposta = await fetch("/api/integracoes/meta/whatsapp/conectar-manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken, wabaId, phoneNumberId, pinExistente: pinExistente || undefined }),
      });
      const dados = (await resposta.json()) as {
        erro?: string;
        dica?: string;
        pin?: string | null;
        pinPendente?: boolean;
      };
      if (!resposta.ok) {
        setDica(dados.dica ?? null);
        throw new Error(dados.erro ?? "Falha ao conectar.");
      }
      // Some com o token da memória do formulário assim que ele já está salvo no servidor.
      setAccessToken("");
      setPin(dados.pin ?? null);
      setPinPendente(Boolean(dados.pinPendente));
      aoConectar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setEnviando(false);
    }
  }

  if (pin || pinPendente) {
    return (
      <div style={{ marginTop: 10 }}>
        {pin ? (
          <>
            <p className="int-title" style={{ margin: 0 }}>Conectado! Guarde este PIN:</p>
            <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: "8px 0" }}>{pin}</p>
            <p className="hint" style={{ margin: 0 }}>
              É o PIN de verificação em duas etapas do seu número na Meta. Ele não aparece de novo —
              anote agora num lugar seguro.
            </p>
          </>
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            Conectado. O número já estava registrado na Meta com um PIN anterior, então esse passo
            ficou pendente — informe o PIN antigo aqui pra completar, se precisar reenviá-lo.
          </p>
        )}
      </div>
    );
  }

  if (!aberto) {
    return (
      <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAberto(true)}>
        Já tenho conta na API oficial — conectar com token
      </button>
    );
  }

  const podeEnviar = accessToken.trim() && wabaId.trim() && phoneNumberId.trim() && !enviando;

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="hint" style={{ margin: 0 }}>
        Use isto se a sua conta do WhatsApp Business já existe e está aprovada no Gerenciador de
        Negócios. Os três valores ficam em business.facebook.com → Configurações → Contas do
        WhatsApp; o token vem de Usuários do sistema → Gerar novo token, com as permissões
        <b> whatsapp_business_messaging</b> e <b>whatsapp_business_management</b>.
      </p>

      <div className="field">
        <label>Token de acesso permanente</label>
        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder="EAAG..."
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
      </div>

      <div className="field">
        <label>ID da conta do WhatsApp (WABA)</label>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="000000000000000"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
        />
      </div>

      <div className="field">
        <label>ID do número de telefone</label>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="000000000000000"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />
      </div>

      <div className="field">
        <label>PIN de verificação em duas etapas (só se o número já tiver um)</label>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="opcional"
          value={pinExistente}
          onChange={(e) => setPinExistente(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn primary" onClick={conectar} disabled={!podeEnviar}>
          {enviando ? "Conectando…" : "Conectar"}
        </button>
        <button type="button" className="btn ghost" onClick={() => setAberto(false)} disabled={enviando}>
          Cancelar
        </button>
      </div>

      {erro ? (
        <div>
          <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>⚠ {erro}</p>
          {dica ? <p className="hint" style={{ margin: "4px 0 0" }}>{dica}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
