"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PermissoesPorModulo } from "@/components/equipe/PermissoesPorModulo";
import { MARCA_DE_VERSAO } from "@/lib/configuracoes/permissoes";
import { cpfValido, digitosDoCpf, formatarCpf } from "@/lib/equipe/cpf";
import { useEquipe } from "@/lib/equipe-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * CONVIDAR ALGUÉM PRA EQUIPE: os dados da pessoa, o nome do papel, e o que ela pode.
 *
 * A TELA ANTERIOR PEDIA PRA ESCOLHER UM PAPEL NUMA LISTA de seis — Administrador, Gestor,
 * Vendedor, Atendente, Gestor de tráfego, Visualizador —, cada um com "N permissões pré-marcadas",
 * e um sétimo item "personalizado" que era o único que deixava escrever o nome. "Não precisa ficar
 * mostrando esses nomes de papéis aqui. Coloca só o papel, eu escolho o nome, pronto."
 *
 * Os papéis prontos eram um palpite sobre como a empresa se organiza, e ele estava quase sempre
 * errado: ninguém usava "Visualizador", e quem queria "Closer" ou "Financeiro" tinha que passar
 * pelo item de baixo. Agora o papel é um campo de texto e as permissões são a resposta de verdade
 * — que é o que a tela da direita sempre foi.
 *
 * `convidarMembro` persiste na API (ver `equipe-context.tsx`), que confere papel, e-mail e CPF
 * de novo: a tela é o navegador.
 */
export function ConvidarForm() {
  const { t: traduzir } = useIdioma();
  const { convidarMembro } = useEquipe();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [papel, setPapel] = useState("");
  /*
   * Começa com a MARCA DE VERSÃO e nada mais: ninguém nasce podendo. Sem a marca, um convite novo
   * sem nenhuma permissão seria lido como "é de antes dos módulos novos" e abriria quatro deles.
   */
  const [permissoes, setPermissoes] = useState<string[]>([MARCA_DE_VERSAO]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** As permissões de verdade: a marca de versão não é uma delas, é só o carimbo. */
  const quantasPermissoes = permissoes.filter((p) => p !== MARCA_DE_VERSAO).length;
  const cpfEstaErrado = cpf.trim().length > 0 && !cpfValido(cpf);

  async function enviarConvite() {
    setErro(null);
    if (!nome.trim() || !email.trim()) {
      setErro(traduzir("Preenche nome e e-mail."));
      return;
    }
    if (!papel.trim()) {
      setErro(traduzir("Dá um nome pro papel dessa pessoa."));
      return;
    }
    if (cpfEstaErrado) {
      setErro(traduzir("Esse CPF não existe. Confere os números."));
      return;
    }

    setEnviando(true);
    try {
      convidarMembro({
        nome: nome.trim(),
        email: email.trim(),
        cpf: digitosDoCpf(cpf),
        papel: papel.trim(),
        /*
         * `admin` continua sendo pelo NOME, e isso é herança que vale manter: é o que dá à pessoa
         * as telas de administração. Qualquer outro nome é papel personalizado — que agora é a
         * regra, não a exceção.
         */
        papelTipo: papel.trim().toLowerCase() === "administrador" ? "admin" : "custom",
        enxerga:
          quantasPermissoes === 0
            ? traduzir("Nenhum módulo do CRM")
            : `${quantasPermissoes} ${traduzir("permissões")}`,
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
          <h4>{traduzir("Dados")}</h4>
        </div>
        <div className="field">
          <label>{traduzir("Nome")}</label>
          <input
            className="input"
            style={{ width: "100%" }}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={traduzir("Nome completo")}
          />
        </div>
        <div className="field">
          <label>{traduzir("E-mail (vai ser o login dele)")}</label>
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
          <label>{traduzir("CPF")}</label>
          <input
            className="input"
            style={{ width: "100%" }}
            inputMode="numeric"
            value={cpf}
            /* A máscara é posta ao SAIR do campo, não a cada tecla: formatar enquanto se digita faz
               o cursor pular quando a pessoa volta pra corrigir um número no meio. */
            onChange={(e) => setCpf(e.target.value)}
            onBlur={() => setCpf((atual) => formatarCpf(atual) || atual)}
            placeholder="000.000.000-00"
          />
          {cpfEstaErrado ? (
            <p className="hint" style={{ color: "var(--danger)", marginTop: 6 }}>
              {traduzir("Esse CPF não existe. Confere os números.")}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label>{traduzir("Papel")}</label>
          <input
            className="input"
            style={{ width: "100%" }}
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            placeholder={traduzir("Ex.: Closer, Financeiro, Social media…")}
          />
          <p className="hint" style={{ marginTop: 6 }}>
            {traduzir("É só o nome do cargo. Quem decide o que essa pessoa pode é a lista ao lado.")}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="panel-h">
          <h4>
            {papel.trim()
              ? `${traduzir("O que")} ${papel.trim()} ${traduzir("pode fazer")}`
              : traduzir("O que essa pessoa pode fazer")}
          </h4>
        </div>

        <PermissoesPorModulo selecionadas={permissoes} onChange={setPermissoes} />

        <p className="hint" style={{ padding: "10px 17px" }}>
          {traduzir(
            'Sem a permissão "Visualizar" de um módulo, esse módulo fica totalmente bloqueado: a pessoa nem consegue abrir a tela.',
          )}
        </p>

        {erro ? <p style={{ color: "var(--danger)", padding: "0 17px 10px", fontSize: 13.5 }}>{erro}</p> : null}

        <div className="section-foot">
          <button type="button" className="btn primary block" onClick={() => void enviarConvite()} disabled={enviando}>
            {enviando ? traduzir("Enviando…") : traduzir("Enviar convite")}
          </button>
        </div>
      </div>
    </div>
  );
}
