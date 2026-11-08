"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { EmpresaSecao } from "./EmpresaSecao";
import { Ajuda } from "@/components/ui";
import { SeletorDeTema } from "@/components/theme-toggle";
import { IconCalendar } from "@/components/icons";
import { FUSO_BRASILIA } from "@/lib/agenda/fuso";
import { formatarTelefoneDoPerfil, lerNomeDoPerfil, lerTelefoneDoPerfil } from "@/lib/perfil/dados";
import { prepararFotoDePerfil } from "@/lib/imagens/preparar-foto";
import { useIdioma } from "@/lib/idioma-context";

type Perfil = {
  nome: string;
  email: string;
  telefone: string | null;
  foto: string | null;
  initials: string;
  criadoEm: string;
};

/**
 * MEU PERFIL: tudo o que é da PESSOA, numa tela só.
 *
 * Entrou no lugar de "Aparência" e puxou "Dados da empresa" pra dentro. Antes isso estava
 * espalhado em três lugares que ninguém relaciona: o tema numa categoria inteira com um
 * interruptor dentro, o e-mail e a senha em Segurança, e o nome em lugar nenhum — só a
 * administração podia trocá-lo, pela tela de Equipe.
 *
 * O DESENHO É O DO AZUZ FLOW, por pedido direto ("pode fazer idêntico"): um cartão no alto com a
 * foto grande, o nome, o e-mail e desde quando, e abaixo cartões em que o TÍTULO FICA À ESQUERDA
 * e os campos à direita. A primeira versão daqui empilhava um bloco por assunto, e "E-mail de
 * acesso" e "Senha" viraram duas caixas repetindo o que Segurança já tem.
 *
 * O E-MAIL APARECE E NÃO SE EDITA. Trocá-lo exige a senha atual e continua em Segurança: é um
 * fluxo com conferência, não um campo. O mesmo vale pra senha, que aqui é um botão só — o link
 * por e-mail, que é o caminho que existe.
 *
 * DEPOIS DE SALVAR O NOME, `update()` pede um token novo: o menu lê o nome e as iniciais do
 * token, não do banco (ver o `jwt` em `auth.ts`).
 */
export function MeuPerfilSecao() {
  const { t: traduzir } = useIdioma();
  const { update } = useSession();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  /** `undefined`: a foto não foi mexida. `null`: tirou. Texto: a nova. */
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [redefinindo, setRedefinindo] = useState<"nao" | "enviando" | "enviado">("nao");
  const entrada = useRef<HTMLInputElement>(null);

  function carregar() {
    return fetch("/api/perfil", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Perfil>) : null))
      .then((corpo) => {
        if (!corpo) return;
        setPerfil(corpo);
        setNome(corpo.nome);
        setTelefone(corpo.telefone ?? "");
        setFoto(undefined);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    // Leitura inicial de um sistema externo (a API), não um reset de prop derivada.
    void carregar();
  }, []);

  const fotoAtual = foto === undefined ? (perfil?.foto ?? null) : foto;
  const iniciais = (perfil?.initials ?? "").slice(0, 1) || "·";
  const mudou =
    perfil !== null &&
    (nome.trim() !== perfil.nome || telefone !== (perfil.telefone ?? "") || foto !== undefined);

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setAviso(null);
    try {
      setFoto(await prepararFotoDePerfil(arquivo));
    } catch (falha) {
      setAviso({
        texto: falha instanceof Error ? falha.message : traduzir("Não deu pra preparar a foto."),
        erro: true,
      });
    }
  }

  async function salvar() {
    if (!perfil) return;
    setAviso(null);

    const nomeLido = lerNomeDoPerfil(nome);
    if (!nomeLido.ok) {
      setAviso({ texto: nomeLido.erro, erro: true });
      return;
    }
    const telefoneLido = lerTelefoneDoPerfil(telefone);
    if (!telefoneLido.ok) {
      setAviso({ texto: telefoneLido.erro, erro: true });
      return;
    }

    const corpo: Record<string, unknown> = {};
    if (nomeLido.valor !== perfil.nome) corpo.nome = nomeLido.valor;
    if (telefoneLido.valor !== (perfil.telefone ?? "")) corpo.telefone = telefoneLido.valor;
    if (foto !== undefined) corpo.foto = foto;
    if (!Object.keys(corpo).length) return;

    setSalvando(true);
    const resposta = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);
    setSalvando(false);

    if (!resposta?.ok) {
      const falha = (await resposta?.json().catch(() => null)) as { erro?: string } | null;
      setAviso({ texto: falha?.erro ?? traduzir("Não deu pra salvar agora. Tente de novo."), erro: true });
      return;
    }
    setAviso({ texto: traduzir("Perfil salvo."), erro: false });
    await carregar();
    // Com `update()` SEM argumento o next-auth só relê a sessão e o `jwt` nunca recebe
    // `trigger: "update"`; qualquer argumento faz o POST. O conteúdo não é usado: o servidor lê o
    // nome do banco, pelo `sub` do token.
    if (corpo.nome !== undefined) await update({ perfil: "nome" });
  }

  function pedirRedefinicaoDeSenha() {
    if (!perfil?.email) return;
    setRedefinindo("enviando");
    fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: perfil.email }),
    })
      .then(() => setRedefinindo("enviado"))
      .catch(() => setRedefinindo("nao"));
  }

  return (
    <div className="config-secao perfil-pagina">
      <div className="config-bloco perfil-topo">
        <div className="perfil-avatar grande" aria-hidden="true">
          {fotoAtual ? (
            /* eslint-disable-next-line @next/next/no-img-element -- data URL do próprio banco: o
               otimizador do Next não tem o que fazer com ela, e `next/image` recusa `data:`. */
            <img src={fotoAtual} alt="" />
          ) : (
            <span>{iniciais}</span>
          )}
        </div>
        <div className="perfil-quem">
          <h3>{perfil?.nome ?? " "}</h3>
          <p className="perfil-email">{perfil?.email ?? " "}</p>
          {perfil ? (
            <p className="perfil-desde">
              <IconCalendar width={15} height={15} aria-hidden="true" />
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: FUSO_BRASILIA }).format(
                new Date(perfil.criadoEm),
              )}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn perfil-sair"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          {traduzir("Sair")}
        </button>
      </div>

      <div className="config-bloco perfil-linhas">
        <p className="config-bloco-titulo">
          {traduzir("Informações")}
          <small>{traduzir("Suas informações de cadastro e login")}</small>
        </p>
        <div className="perfil-campos">
          <div className="field">
            <label htmlFor="perfil-nome">{traduzir("Nome")}</label>
            <input
              id="perfil-nome"
              className="input"
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="perfil-telefone">{traduzir("Telefone")}</label>
            <input
              id="perfil-telefone"
              className="input"
              value={telefone}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              onChange={(e) => setTelefone(formatarTelefoneDoPerfil(e.target.value))}
            />
          </div>
          <div className="field">
            <div className="rotulo-com-dica">
              <label htmlFor="perfil-email">{traduzir("E-mail")}</label>
              <Ajuda texto={traduzir("O e-mail de acesso se troca em Segurança, com a senha atual.")} />
            </div>
            <input id="perfil-email" className="input" value={perfil?.email ?? ""} disabled readOnly />
          </div>
          <div className="field">
            <div className="rotulo-com-dica">
              <label htmlFor="perfil-fuso">{traduzir("Fuso horário")}</label>
              <Ajuda
                texto={traduzir(
                  "O CRM usa o horário de Brasília na agenda, nas automações, nos avisos e nos relatórios.",
                )}
              />
            </div>
            <input id="perfil-fuso" className="input" value="Brasília (GMT-3)" disabled readOnly />
          </div>
          <div className="field">
            <div className="rotulo-com-dica">
              <label>{traduzir("Senha")}</label>
              <Ajuda
                texto={`${traduzir("Enviamos um link pra")} ${perfil?.email ?? ""}${traduzir(", sem precisar digitar a senha atual.")}`}
              />
            </div>
            <button
              type="button"
              className="btn perfil-botao-largo"
              onClick={pedirRedefinicaoDeSenha}
              disabled={redefinindo !== "nao" || !perfil}
            >
              {redefinindo === "enviado"
                ? traduzir("Link enviado")
                : redefinindo === "enviando"
                  ? traduzir("Enviando…")
                  : traduzir("Alterar senha")}
            </button>
            {redefinindo === "enviado" ? (
              <p className="hint">
                {traduzir("Confira a caixa de entrada de")} {perfil?.email} {traduzir("(e o spam).")}
              </p>
            ) : null}
          </div>
        </div>

        <p className="config-bloco-titulo perfil-segunda">
          {traduzir("Imagem de perfil")}
          <small>{traduzir("Faça o upload da sua imagem de perfil aqui")}</small>
        </p>
        <div className="perfil-campos perfil-segunda">
          <div className="perfil-foto">
            <div className="perfil-avatar" aria-hidden="true">
              {fotoAtual ? (
                /* eslint-disable-next-line @next/next/no-img-element -- ver acima */
                <img src={fotoAtual} alt="" />
              ) : (
                <span>{iniciais}</span>
              )}
            </div>
            <button type="button" className="perfil-arquivo" onClick={() => entrada.current?.click()}>
              <span>{traduzir("Escolher arquivo")}</span>
            </button>
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              hidden
              aria-label={traduzir("Arquivo da imagem de perfil")}
              onChange={(e) => {
                const escolhida = e.target.files?.[0];
                e.target.value = "";
                void escolherArquivo(escolhida);
              }}
            />
          </div>
          {fotoAtual ? (
            <button type="button" className="link perfil-tirar" onClick={() => setFoto(null)}>
              {traduzir("Tirar a foto")}
            </button>
          ) : null}
          <div className="perfil-rodape">
            {aviso ? (
              <p className={aviso.erro ? "config-aviso-erro" : "hint"} role={aviso.erro ? "alert" : "status"}>
                {aviso.texto}
              </p>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="btn primary"
              disabled={!mudou || salvando}
              onClick={() => void salvar()}
            >
              {salvando ? traduzir("Salvando…") : traduzir("Salvar")}
            </button>
          </div>
        </div>
      </div>

      <div className="config-bloco perfil-linhas">
        <p className="config-bloco-titulo">
          {traduzir("Preferências")}
          <small>{traduzir("Personalize a aparência do app selecionando o tema")}</small>
        </p>
        <div className="perfil-campos">
          <div className="field">
            <label htmlFor="perfil-tema">{traduzir("Tema")}</label>
            <SeletorDeTema id="perfil-tema" />
          </div>
        </div>
      </div>

      <div className="perfil-grupo">
        <h3>{traduzir("Empresa")}</h3>
        <EmpresaSecao incorporada />
      </div>
    </div>
  );
}
