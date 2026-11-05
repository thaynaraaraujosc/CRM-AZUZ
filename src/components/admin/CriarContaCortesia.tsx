"use client";

import { useState, type FormEvent } from "react";

import { Ajuda } from "@/components/ui";
import { CampoDeSenha } from "@/components/campo-de-senha";
import { PRAZOS_DE_CORTESIA, fimDaCortesia } from "@/lib/assinatura/cortesia";
import { useIdioma } from "@/lib/idioma-context";

type Criada = {
  workspaceId: string;
  linkConvite: string | null;
  comSenha: boolean;
  cortesiaAte: string | null;
  emailEnviado: boolean;
  motivoEmail?: string;
};

/**
 * Cria uma conta de cortesia: empresa nova, a pessoa como administradora, o CRM liberado sem
 * cobrança — e, agora, com PRAZO.
 *
 * O prazo é o que faltava. Sem ele, liberar o CRM pra alguém ver por três meses virava liberar
 * pra sempre: ninguém lembra de voltar no painel pra encerrar, e o jeito de descobrir era o
 * cliente perguntar por que nunca foi cobrado. Com a data, a conta vira cobrável sozinha no dia
 * marcado, e é dela que a primeira cobrança parte.
 *
 * A SENHA é opcional, e o convite continua sendo o caminho normal: quem cria a senha deveria ser
 * a própria pessoa. Mas há o caso de entregar a conta na mão — numa reunião, numa demonstração —
 * e aí o convite por e-mail é um degrau a mais que faz a entrega falhar na frente do cliente.
 */
export function CriarContaCortesia({ aoCriar }: { aoCriar: () => void }) {
  const { t: traduzir } = useIdioma();
  const [aberto, setAberto] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  /* Cortesia é sim/não, e o prazo é a pergunta seguinte: ver o bloco no detalhe da empresa. */
  const [cortesia, setCortesia] = useState(true);
  const [meses, setMeses] = useState(3);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<Criada | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa,
          nome,
          email,
          senha: senha || undefined,
          cortesia,
          // Sem cortesia não há prazo nenhum: a conta nasce cobrável.
          meses: cortesia ? meses : 0,
        }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível criar a conta.");
        return;
      }
      setCriada(dados as Criada);
      setEmpresa("");
      setNome("");
      setEmail("");
      setSenha("");
      aoCriar();
    } catch {
      setErro("Não foi possível criar a conta agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  if (criada) {
    const ate = criada.cortesiaAte ? new Date(criada.cortesiaAte).toLocaleDateString("pt-BR") : null;
    return (
      <div className="admin-bloco config-bloco">
        <p className="config-bloco-titulo">{traduzir("Conta criada e liberada")}</p>
        <p className="hint">
          <strong>{criada.workspaceId}</strong>
          {ate ? ` · de graça até ${ate}, e cobrável a partir dessa data.` : " · criada e liberada."}
        </p>

        {criada.comSenha ? (
          <p className="hint">
            {criada.emailEnviado
              ? "O e-mail com o endereço e a senha foi enviado pra pessoa. Ela já pode entrar."
              : `O e-mail não saiu (${criada.motivoEmail ?? "motivo não informado"}) — passe o e-mail e a senha pra pessoa na mão, porque sem eles ela não tem como entrar.`}
          </p>
        ) : (
          <>
            <div className="filters-row" style={{ marginTop: 10 }}>
              <input
                className="input"
                style={{ flex: 1, fontFamily: "monospace" }}
                readOnly
                value={criada.linkConvite ?? ""}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigator.clipboard.writeText(criada.linkConvite ?? "")}
              >
                {traduzir("Copiar link")}
              </button>
            </div>
            <p className="hint">
              {criada.emailEnviado
                ? "O convite também foi por e-mail. O link vale 7 dias e só funciona uma vez."
                : `O e-mail não saiu (${criada.motivoEmail ?? "motivo não informado"}). O link acima funciona do mesmo jeito.`}
            </p>
          </>
        )}

        <div className="config-acoes">
          <button type="button" className="btn ghost" onClick={() => setCriada(null)}>
            {traduzir("Criar outra")}
          </button>
        </div>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="admin-acoes-topo">
        <button type="button" className="btn primary" onClick={() => setAberto(true)}>
          {traduzir("Criar conta")}
        </button>
      </div>
    );
  }

  const terminaEm = cortesia && meses > 0 ? fimDaCortesia(meses).toLocaleDateString("pt-BR") : null;

  return (
    <form className="admin-bloco config-bloco" onSubmit={enviar}>
      <p className="config-bloco-titulo">
        {traduzir("Nova conta")}
        <Ajuda
          texto={traduzir(
            "Cria a empresa, a pessoa como administradora dela e o CRM já liberado. Nenhuma cobrança é criada: não existe fatura, boleto nem cartão por trás desta conta.",
          )}
        />
      </p>

      <div className="config-grid-2">
        <div className="field">
          <label htmlFor="cortesia-empresa">{traduzir("Nome da empresa")}</label>
          <input
            id="cortesia-empresa"
            className="input"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Clínica do Lucas"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cortesia-nome">{traduzir("Nome da pessoa")}</label>
          <input
            id="cortesia-nome"
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Lucas Arantes"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cortesia-email">{traduzir("E-mail")}</label>
          <input
            id="cortesia-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@empresa.com.br"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cortesia-senha">
            {traduzir("Senha")}
            <Ajuda
              texto={traduzir(
                "Opcional. Com senha, a conta já entra e a pessoa recebe um e-mail com o endereço e a senha, pedindo pra trocá-la no primeiro acesso. Em branco, sai um convite e quem cria a senha é ela mesma — que é o mais seguro, porque aí ninguém além dela chega a saber a senha.",
              )}
            />
          </label>
          <CampoDeSenha
            id="cortesia-senha"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={traduzir("em branco = mandar convite")}
            minLength={8}
          />
        </div>
      </div>

      <div className="field">
        <label>
          {traduzir("Conta de cortesia")}
          <Ajuda
            texto={traduzir(
              "Sim libera o CRM sem nenhuma cobrança. Não cria a conta já cobrável, como a de qualquer cliente que se cadastra sozinho.",
            )}
          />
        </label>
        <div className="seg-picker" role="group" aria-label={traduzir("Conta de cortesia")}>
          <button
            type="button"
            className={`seg-chip${cortesia ? " on" : ""}`}
            aria-pressed={cortesia}
            onClick={() => setCortesia(true)}
          >
            {traduzir("Sim")}
          </button>
          <button
            type="button"
            className={`seg-chip${cortesia ? "" : " on"}`}
            aria-pressed={!cortesia}
            onClick={() => setCortesia(false)}
          >
            {traduzir("Não")}
          </button>
        </div>
      </div>

      {cortesia ? (
        <div className="field">
          <label>
            {traduzir("Por quanto tempo")}
            <Ajuda
              texto={traduzir(
                "Com prazo, a conta cai na tela de pagamento sozinha no dia marcado, e a primeira cobrança parte dessa data. Sem prazo, ela fica de graça até alguém encerrar no detalhe da empresa.",
              )}
            />
          </label>
          <div className="seg-picker" role="group" aria-label={traduzir("Por quanto tempo")}>
            <button
              type="button"
              className={`seg-chip${meses === 0 ? " on" : ""}`}
              aria-pressed={meses === 0}
              onClick={() => setMeses(0)}
            >
              {traduzir("Sem prazo")}
            </button>
            {PRAZOS_DE_CORTESIA.map((p) => (
              <button
                key={p.meses}
                type="button"
                className={`seg-chip${meses === p.meses ? " on" : ""}`}
                aria-pressed={meses === p.meses}
                onClick={() => setMeses(p.meses)}
              >
                {traduzir(p.label)}
              </button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            {terminaEm
              ? `Grátis até ${terminaEm}. A partir daí, R$ 197,00/mês.`
              : "De graça por tempo indeterminado, até alguém encerrar no detalhe da empresa."}
          </p>
        </div>
      ) : null}

      {erro && <p className="auth-erro">{erro}</p>}

      <div className="config-acoes">
        <button type="submit" className={`btn primary${salvando ? " loading" : ""}`} disabled={salvando}>
          {traduzir("Criar e liberar")}
        </button>
        <button type="button" className="btn ghost" onClick={() => setAberto(false)} disabled={salvando}>
          {traduzir("Cancelar")}
        </button>
      </div>
    </form>
  );
}
