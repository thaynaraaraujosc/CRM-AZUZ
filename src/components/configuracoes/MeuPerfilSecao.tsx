"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { EmpresaSecao } from "./EmpresaSecao";
import { SalvarBar } from "./SalvarBar";
import { CampoDeSenha } from "@/components/campo-de-senha";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconCadeado, IconEscudo, IconLixeira } from "@/components/icons";
import { formatarTelefoneDoPerfil, iniciaisDe, lerNomeDoPerfil, lerTelefoneDoPerfil } from "@/lib/perfil/dados";
import { prepararFotoDePerfil } from "@/lib/imagens/preparar-foto";
import { useIdioma } from "@/lib/idioma-context";

/**
 * MEU PERFIL: tudo o que é da PESSOA, numa tela só.
 *
 * Antes isso estava espalhado em três lugares que ninguém relaciona: o tema em "Aparência", o
 * e-mail e a senha em "Segurança", e o nome em lugar nenhum — só a administração podia trocá-lo,
 * pela tela de Equipe. Quem queria trocar a própria foto não tinha caminho.
 *
 * "Você vai trocar a aparência e dados da empresa por apenas um botão, que vai chamar meu
 * perfil." É o agrupamento certo: a pergunta que a pessoa faz não é "onde fica a configuração de
 * tema", é "onde eu mexo nas minhas coisas".
 *
 * A EMPRESA ENTRA AQUI COMO UM BLOCO, e não como outra categoria do menu. Numa agência de uma
 * pessoa — que é o caso da maioria das contas — "meus dados" e "os dados da empresa" são a mesma
 * visita; duas entradas no menu obrigavam a escolher entre elas antes de saber qual tinha o campo
 * procurado.
 *
 * O QUE AINDA NÃO EXISTE APARECE DESLIGADO, e escrito. Verificação em duas etapas, modo
 * privacidade e excluir conta estão na lista do pedido e não estão de pé: um interruptor que não
 * liga nada é pior do que a ausência dele, porque a pessoa sai acreditando que ligou.
 */

type Perfil = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  foto: string | null;
  initials: string;
  papel: string;
  criadoEm: string;
  ehAdministrador: boolean;
};

export function MeuPerfilSecao() {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  const entradaDaFoto = useRef<HTMLInputElement>(null);

  /* --- e-mail e senha: as mesmas rotas que Segurança já usava --- */
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);
  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [emailAlterado, setEmailAlterado] = useState(false);

  useEffect(() => {
    fetch("/api/perfil", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Perfil>) : null))
      .then((corpo) => {
        if (!corpo) return;
        setPerfil(corpo);
        setNome(corpo.nome);
        setTelefone(corpo.telefone ?? "");
      })
      .catch(() => setErro(traduzir("Não deu pra ler o seu perfil. Recarregue a página.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudou = Boolean(perfil) && (nome !== perfil!.nome || telefone !== (perfil!.telefone ?? ""));
  const iniciais = perfil ? iniciaisDe(perfil.nome) : (sessao?.user?.initials ?? "");

  async function gravar(campos: Record<string, unknown>): Promise<boolean> {
    setErro(null);
    setRecado(null);
    const resposta = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    }).catch(() => null);
    if (!resposta?.ok) {
      const corpo = (await resposta?.json().catch(() => null)) as { erro?: string } | null;
      setErro(corpo?.erro ?? traduzir("Não deu pra salvar agora. Tente de novo."));
      return false;
    }
    const corpo = (await resposta.json().catch(() => null)) as Perfil | null;
    if (corpo) {
      setPerfil((atual) => (atual ? { ...atual, ...corpo } : atual));
      setNome(corpo.nome);
      setTelefone(corpo.telefone ?? "");
    }
    return true;
  }

  async function salvarDados() {
    const nomeLido = lerNomeDoPerfil(nome);
    if (!nomeLido.ok) {
      setErro(nomeLido.erro);
      return;
    }
    const telefoneLido = lerTelefoneDoPerfil(telefone);
    if (!telefoneLido.ok) {
      setErro(telefoneLido.erro);
      return;
    }
    if (await gravar({ nome: nomeLido.valor, telefone: telefoneLido.valor })) {
      setRecado(traduzir("Seus dados foram salvos."));
    }
  }

  function descartar() {
    if (!perfil) return;
    setNome(perfil.nome);
    setTelefone(perfil.telefone ?? "");
    setErro(null);
  }

  async function trocarFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    setTrocandoFoto(true);
    setErro(null);
    setRecado(null);
    try {
      const dataUrl = await prepararFotoDePerfil(arquivo);
      if (await gravar({ foto: dataUrl })) setRecado(traduzir("Foto atualizada."));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : traduzir("Não deu pra usar essa imagem."));
    } finally {
      setTrocandoFoto(false);
    }
  }

  async function tirarFoto() {
    setTrocandoFoto(true);
    if (await gravar({ foto: null })) setRecado(traduzir("Foto removida."));
    setTrocandoFoto(false);
  }

  function pedirRedefinicaoSenha() {
    if (!perfil?.email) return;
    setEnviandoReset(true);
    fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: perfil.email }),
    })
      .then(() => setResetEnviado(true))
      .catch(() => setErro(traduzir("Não deu pra enviar o link agora. Tente de novo.")))
      .finally(() => setEnviandoReset(false));
  }

  function salvarNovoEmail() {
    setErroEmail(null);
    setSalvandoEmail(true);
    fetch("/api/auth/alterar-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senhaAtual, novoEmail }),
    })
      .then(async (r) => {
        const dados = (await r.json().catch(() => null)) as { erro?: string } | null;
        if (!r.ok) throw new Error(dados?.erro || traduzir("Não foi possível alterar o e-mail."));
        setEmailAlterado(true);
        setTrocandoEmail(false);
        setPerfil((atual) => (atual ? { ...atual, email: novoEmail } : atual));
        setSenhaAtual("");
        setNovoEmail("");
      })
      .catch((falha: Error) => setErroEmail(falha.message))
      .finally(() => setSalvandoEmail(false));
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo={traduzir("Meu perfil")}
        descricao={traduzir("Seus dados, seu acesso e a sua empresa.")}
      />

      {erro ? <p className="config-aviso-erro">{erro}</p> : null}
      {recado ? <p className="hint">{recado}</p> : null}

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Foto e dados")}</p>

        <div className="perfil-topo">
          <div className="perfil-foto">
            {perfil?.foto ? (
              /* eslint-disable-next-line @next/next/no-img-element -- data URL do próprio banco: o
                 otimizador do Next não tem o que fazer com ela, e `next/image` recusa `data:`. */
              <img src={perfil.foto} alt={traduzir("Sua foto de perfil")} />
            ) : (
              <span aria-hidden="true">{iniciais}</span>
            )}
          </div>
          <div className="perfil-foto-acoes">
            <button
              type="button"
              className="btn"
              disabled={trocandoFoto}
              onClick={() => entradaDaFoto.current?.click()}
            >
              {trocandoFoto ? traduzir("Salvando…") : perfil?.foto ? traduzir("Trocar foto") : traduzir("Escolher foto")}
            </button>
            {perfil?.foto ? (
              <button type="button" className="btn ghost" disabled={trocandoFoto} onClick={() => void tirarFoto()}>
                {traduzir("Tirar foto")}
              </button>
            ) : null}
            <p className="hint">{traduzir("PNG ou JPG. A imagem é recortada num quadrado pelo centro.")}</p>
          </div>
          <input
            ref={entradaDaFoto}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void trocarFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="config-grid-2">
          <div className="field">
            <label htmlFor="perfil-nome">{traduzir("Nome")}</label>
            <input
              id="perfil-nome"
              className="input"
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              placeholder={traduzir("Como você aparece pra equipe")}
            />
          </div>
          <div className="field">
            <label htmlFor="perfil-telefone">{traduzir("Telefone")}</label>
            <input
              id="perfil-telefone"
              className="input"
              value={telefone}
              inputMode="tel"
              onChange={(e) => setTelefone(formatarTelefoneDoPerfil(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("E-mail de acesso")}</p>
        {!trocandoEmail ? (
          <div className="toggle-row" style={{ padding: "6px 0" }}>
            <span className="tl">{perfil?.email ?? sessao?.user?.email ?? "—"}</span>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setTrocandoEmail(true);
                setEmailAlterado(false);
                setErroEmail(null);
              }}
            >
              {traduzir("Alterar e-mail")}
            </button>
          </div>
        ) : (
          <div className="config-grid-2">
            <div className="field">
              <label>{traduzir("Senha atual")}</label>
              <CampoDeSenha
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder={traduzir("Confirme sua senha")}
              />
            </div>
            <div className="field">
              <label>{traduzir("Novo e-mail")}</label>
              <input
                className="input"
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="novo@email.com"
              />
            </div>
            {erroEmail ? <p className="config-aviso-erro" style={{ gridColumn: "1 / -1" }}>{erroEmail}</p> : null}
            <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
              <button
                type="button"
                className="btn primary"
                onClick={salvarNovoEmail}
                disabled={salvandoEmail || !senhaAtual || !novoEmail}
              >
                {salvandoEmail ? traduzir("Salvando…") : traduzir("Confirmar troca")}
              </button>
              <button type="button" className="btn ghost" onClick={() => setTrocandoEmail(false)} disabled={salvandoEmail}>
                {traduzir("Cancelar")}
              </button>
            </div>
          </div>
        )}
        {emailAlterado ? (
          <p className="hint">
            {traduzir("E-mail alterado. Use o novo e-mail (com a mesma senha) da próxima vez que entrar.")}
          </p>
        ) : null}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Senha")}</p>
        <div className="toggle-row" style={{ padding: "6px 0" }}>
          <span className="tl">
            {traduzir("Mandamos um link de redefinição pro seu e-mail. Você não precisa lembrar a senha atual.")}
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={pedirRedefinicaoSenha}
            disabled={enviandoReset || resetEnviado}
          >
            {resetEnviado ? traduzir("Link enviado") : enviandoReset ? traduzir("Enviando…") : traduzir("Redefinir senha")}
          </button>
        </div>
        {resetEnviado ? (
          <p className="hint">{traduzir("Confira a caixa de entrada (e o spam).")}</p>
        ) : null}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Tema")}</p>
        <ThemeToggle />
      </div>

      {/*
        O QUE AINDA NÃO ESTÁ DE PÉ, escrito como não estando.
        
        Os três vieram na lista do pedido. Nenhum deles é uma tela: verificação em duas etapas é
        um segundo fator no login inteiro, privacidade é uma regra que o CRM precisa obedecer em
        cada consulta, e excluir conta é apagar dados de clientes de verdade — com cobrança
        aberta, conversa em andamento e equipe junto. Desenhar o interruptor antes de existir o
        que ele liga é o jeito mais rápido de alguém acreditar que ativou a segunda etapa.
      */}
      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Ainda não está pronto")}</p>
        <div className="config-lista-linhas">
          <div className="perfil-futuro">
            <IconEscudo width={16} height={16} aria-hidden="true" />
            <div>
              <p className="n">
                {traduzir("Verificação em duas etapas")} <span className="nav-badge-em-breve">{traduzir("Em breve")}</span>
              </p>
              <p className="r">{traduzir("Um código a mais na hora de entrar, além da senha.")}</p>
            </div>
          </div>
          <div className="perfil-futuro">
            <IconCadeado width={16} height={16} aria-hidden="true" />
            <div>
              <p className="n">
                {traduzir("Modo privacidade")} <span className="nav-badge-em-breve">{traduzir("Em breve")}</span>
              </p>
              <p className="r">{traduzir("Esconder telefone e e-mail dos contatos na tela, pra usar o CRM em reunião.")}</p>
            </div>
          </div>
          <div className="perfil-futuro">
            <IconLixeira width={16} height={16} aria-hidden="true" />
            <div>
              <p className="n">
                {traduzir("Excluir conta")} <span className="nav-badge-em-breve">{traduzir("Em breve")}</span>
              </p>
              <p className="r">
                {traduzir("Enquanto não existe o botão, peça pelo suporte: a exclusão apaga contatos, conversas e automações da empresa inteira.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* A empresa, no mesmo lugar: numa agência de uma pessoa, é a mesma visita. */}
      <EmpresaSecao semCabecalho />

      <SalvarBar dirty={mudou} onSalvar={() => void salvarDados()} onDescartar={descartar} />
    </div>
  );
}
