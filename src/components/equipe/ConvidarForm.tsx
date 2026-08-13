"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useEquipe } from "@/lib/equipe-context";
import { FUNCOES_PADRAO, PERMISSOES_POR_MODULO } from "@/lib/configuracoes/permissoes";
import { RadioList, Toggle } from "@/components/ui";

const OPCAO_PERSONALIZADO = "Papel personalizado";

/**
 * Formulário de convite — nasce em branco (item 1 do pedido: nada pré-preenchido, é uma conta
 * nova). Nome/e-mail são digitados de verdade; o papel escolhe uma função padrão (com as
 * permissões dela já marcadas, mas editáveis) ou "personalizado" (começa zerado, você monta do
 * zero). `convidarMembro` já persiste na API de verdade (ver `equipe-context.tsx`).
 */
export function ConvidarForm() {
  const { convidarMembro } = useEquipe();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [funcaoSelecionada, setFuncaoSelecionada] = useState(OPCAO_PERSONALIZADO);
  const [nomePapelCustom, setNomePapelCustom] = useState("");
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoesPapel = [
    ...FUNCOES_PADRAO.map((f) => ({ nome: f.nome, descricao: `${f.permissoesPadrao.length} permissões pré-marcadas` })),
    {
      nome: OPCAO_PERSONALIZADO,
      descricao: "Você escolhe o nome e cada permissão, do zero",
      boxed: true,
    },
  ];

  function selecionarFuncao(nomeSelecionado: string) {
    setFuncaoSelecionada(nomeSelecionado);
    const padrao = FUNCOES_PADRAO.find((f) => f.nome === nomeSelecionado);
    setPermissoes(padrao ? [...padrao.permissoesPadrao] : []);
  }

  function alternarPermissao(id: string, ligado: boolean) {
    setPermissoes((atual) => (ligado ? [...new Set([...atual, id])] : atual.filter((p) => p !== id)));
  }

  const ehPersonalizado = funcaoSelecionada === OPCAO_PERSONALIZADO;
  const nomePapelFinal = ehPersonalizado ? nomePapelCustom.trim() : funcaoSelecionada;

  async function enviarConvite() {
    setErro(null);
    if (!nome.trim() || !email.trim()) {
      setErro("Preenche nome e e-mail.");
      return;
    }
    if (ehPersonalizado && !nomePapelCustom.trim()) {
      setErro("Dá um nome pro papel personalizado.");
      return;
    }

    setEnviando(true);
    try {
      convidarMembro({
        nome: nome.trim(),
        email: email.trim(),
        papel: nomePapelFinal,
        papelTipo: nomePapelFinal === "Administrador" ? "admin" : ehPersonalizado ? "custom" : "padrao",
        papelNota: ehPersonalizado ? "· personalizado" : undefined,
        enxerga: permissoes.length === 0 ? "Nenhum módulo do CRM" : `${permissoes.length} permissões`,
        permissoes,
      });
      router.push("/equipe");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid rep-grid">
      <div className="card">
        <div className="panel-h">
          <h4>Dados</h4>
        </div>
        <div className="field">
          <label>Nome</label>
          <input className="input" style={{ width: "100%" }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="field">
          <label>E-mail (vai ser o login dele)</label>
          <input
            className="input"
            style={{ width: "100%" }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@empresa.com.br"
          />
        </div>
        <div className="field">
          <label>Papel</label>
          <RadioList options={opcoesPapel} initial={OPCAO_PERSONALIZADO} bare onChange={selecionarFuncao} />
          {ehPersonalizado ? (
            <input
              className="input mt14"
              style={{ width: "100%" }}
              value={nomePapelCustom}
              onChange={(e) => setNomePapelCustom(e.target.value)}
              placeholder="Ex.: Estoquista, Financeiro…"
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="panel-h">
          <h4>Permissões de {nomePapelFinal || "…"}, módulo por módulo</h4>
        </div>
        {PERMISSOES_POR_MODULO.map((grupo) => (
          <div key={grupo.modulo}>
            <p className="hint" style={{ padding: "10px 17px 2px", fontWeight: 700, color: "var(--text-muted)" }}>
              {grupo.modulo}
            </p>
            {grupo.permissoes.map((permissao) => (
              <div className="toggle-row" key={permissao.id}>
                <span className="tl">{permissao.label}</span>
                <Toggle
                  key={`${permissao.id}-${funcaoSelecionada}`}
                  defaultOn={permissoes.includes(permissao.id)}
                  label={permissao.label}
                  onToggle={(ligado) => alternarPermissao(permissao.id, ligado)}
                />
              </div>
            ))}
          </div>
        ))}
        <p className="hint" style={{ padding: "10px 17px" }}>
          Sem a permissão &quot;Visualizar&quot; de um módulo, esse módulo fica totalmente bloqueado pra essa pessoa — ela nem consegue abrir a tela.
        </p>

        {erro ? <p style={{ color: "var(--danger)", padding: "0 17px 10px", fontSize: 12.5 }}>{erro}</p> : null}

        <div className="section-foot">
          <button type="button" className="btn primary block" onClick={enviarConvite} disabled={enviando}>
            {enviando ? "Enviando…" : `Enviar convite${nomePapelFinal ? ` pro ${nomePapelFinal}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
