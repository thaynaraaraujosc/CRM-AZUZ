"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSession } from "next-auth/react";

import { MarcaDoTopo } from "@/components/marca-do-topo";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { SalvarBar } from "./SalvarBar";
import { useIdioma } from "@/lib/idioma-context";
import {
  formatarDocumento,
  formatarTelefoneDaEmpresa,
  lerDadosDaEmpresa,
  lerNomeDoEspaco,
} from "@/lib/empresa/dados";
import { LOGO_SLOT } from "@/lib/imagens/tamanho-da-logo";
import { enviarLogoDaEmpresa, tirarLogoDaEmpresa, useLogoDaEmpresa } from "@/lib/logo-da-empresa";

/**
 * DADOS DA EMPRESA: o cartão de visita da agência dentro do CRM.
 *
 * DOIS BLOCOS, PORQUE SÃO DUAS COISAS. O ESPAÇO DE TRABALHO é o nome que aparece no menu, nos
 * convites e nos e-mails; a EMPRESA é quem ela é — razão social, CNPJ, contato. A agência pode se
 * chamar "AZUZ Digital" e ter o espaço "AZUZ DIGITAL TECH", e um campo só obrigaria um a imitar o
 * outro. O perfil de cada pessoa (nome, e-mail de acesso, senha) é outro assunto, e mora em
 * Segurança.
 *
 * A LOGO SALVA NA HORA, sem passar pelo botão. Escolher o arquivo já é a decisão — ninguém abre o
 * seletor por engano. Os campos de texto salvam juntos, no botão, porque ali a pessoa ainda está
 * escrevendo.
 *
 * A PRÉVIA É O TOPO DO MENU DE VERDADE: o mesmo componente, no mesmo tamanho, sobre as mesmas
 * cores. Uma caixa "parecida" desenhada à parte é como se chega numa prévia que corta a imagem e
 * num menu que mostra outra coisa. Clicar nela troca o arquivo.
 *
 * QUEM EDITA: a administração. O resto da equipe vê o nome do espaço e a logo (que aparecem pra
 * todo mundo no menu) e não vê o documento nem o contato da empresa — é dado administrativo, e uma
 * tela que mostra o que a pessoa não pode mudar ensina a ignorar o que está escrito.
 */

type Dados = {
  nome: string;
  logo: string | null;
  ehAdministrador: boolean;
  empresaNome?: string;
  empresaFantasia?: string;
  empresaDocumento?: string;
  empresaEmail?: string;
  empresaTelefone?: string;
  empresaSite?: string;
  empresaEndereco?: string;
};

type Formulario = {
  nome: string;
  empresaNome: string;
  empresaFantasia: string;
  empresaDocumento: string;
  empresaEmail: string;
  empresaTelefone: string;
  empresaSite: string;
  empresaEndereco: string;
};

const VAZIO: Formulario = {
  nome: "",
  empresaNome: "",
  empresaFantasia: "",
  empresaDocumento: "",
  empresaEmail: "",
  empresaTelefone: "",
  empresaSite: "",
  empresaEndereco: "",
};

function formularioDe(dados: Dados): Formulario {
  return {
    nome: dados.nome,
    empresaNome: dados.empresaNome ?? "",
    empresaFantasia: dados.empresaFantasia ?? "",
    empresaDocumento: dados.empresaDocumento ?? "",
    empresaEmail: dados.empresaEmail ?? "",
    empresaTelefone: dados.empresaTelefone ?? "",
    empresaSite: dados.empresaSite ?? "",
    empresaEndereco: dados.empresaEndereco ?? "",
  };
}

export function EmpresaSecao() {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const souAdmin = sessao?.user?.papelTipo === "admin" || Boolean(sessao?.user?.superAdmin);

  const [salvo, setSalvo] = useState<Formulario>(VAZIO);
  const [rascunho, setRascunho] = useState<Formulario>(VAZIO);
  const [ehAdministrador, setEhAdministrador] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [trocandoLogo, setTrocandoLogo] = useState(false);
  const entradaDaLogo = useRef<HTMLInputElement>(null);
  const { logo } = useLogoDaEmpresa();

  async function carregar() {
    const resposta = await fetch("/api/workspace", { cache: "no-store" }).catch(() => null);
    if (!resposta?.ok) {
      setErro(traduzir("Não deu pra ler os dados da empresa. Recarregue a página."));
      return;
    }
    const corpo = (await resposta.json().catch(() => null)) as Dados | null;
    if (!corpo) return;
    setEhAdministrador(corpo.ehAdministrador);
    const formulario = formularioDe(corpo);
    setSalvo(formulario);
    setRascunho(formulario);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura inicial de um sistema externo (a API) ao montar a seção, não reset de prop derivada: não realimenta o próprio efeito
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `ehAdministrador` do servidor é a palavra final; a sessão só evita piscar o formulário antes
  // da resposta chegar.
  const podeEditar = ehAdministrador ?? souAdmin;
  const mudou = (Object.keys(rascunho) as (keyof Formulario)[]).some((campo) => rascunho[campo] !== salvo[campo]);

  function mexer(campo: keyof Formulario, valor: string) {
    setErro(null);
    setRecado(null);
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    setErro(null);
    setRecado(null);

    // As MESMAS funções que a rota usa: a tela avisa antes de mandar, e o servidor recusa de novo.
    const nomeLido = lerNomeDoEspaco(rascunho.nome);
    if (!nomeLido.ok) {
      setErro(nomeLido.erro);
      return;
    }
    const empresaLida = lerDadosDaEmpresa(rascunho);
    if (!empresaLida.ok) {
      setErro(empresaLida.erro);
      return;
    }

    const resposta = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeLido.valor, ...empresaLida.dados }),
    }).catch(() => null);

    if (!resposta?.ok) {
      const corpo = (await resposta?.json().catch(() => null)) as { erro?: string } | null;
      setErro(corpo?.erro ?? traduzir("Não deu pra salvar agora. Tente de novo."));
      return;
    }
    // Relê em vez de confiar no rascunho: é o servidor que diz como o documento e o telefone
    // ficaram gravados depois da normalização.
    await carregar();
    setRecado(traduzir("Dados da empresa salvos."));
  }

  async function trocarLogo(arquivo: File | undefined) {
    if (!arquivo) return;
    setTrocandoLogo(true);
    setErro(null);
    setRecado(null);
    const falha = await enviarLogoDaEmpresa(arquivo);
    if (falha) setErro(falha);
    else setRecado(traduzir("Logo atualizada."));
    setTrocandoLogo(false);
  }

  async function tirarLogo() {
    setTrocandoLogo(true);
    setErro(null);
    setRecado(null);
    const falha = await tirarLogoDaEmpresa();
    if (falha) setErro(falha);
    setTrocandoLogo(false);
  }

  function abrirSeletor() {
    if (!trocandoLogo) entradaDaLogo.current?.click();
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo={traduzir("Dados da empresa")}
        descricao={traduzir("A identidade da sua agência dentro do CRM.")}
      />

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Logotipo")}</p>
        <div className="empresa-logo">
          <div
            className="empresa-logo-previa"
            {...(podeEditar
              ? {
                  role: "button",
                  tabIndex: 0,
                  title: traduzir("Clique para trocar o logotipo"),
                  onClick: abrirSeletor,
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrirSeletor();
                    }
                  },
                }
              : {})}
          >
            {/* O topo do menu DE VERDADE, com as cores do menu: é a prévia honesta. */}
            <div className="sidebar logo-previa-menu" aria-label={traduzir("Como a logo aparece no topo do menu")}>
              <div className="sb-brand">
                <MarcaDoTopo />
              </div>
            </div>
          </div>

          {podeEditar ? (
            <div className="empresa-logo-acoes">
              <button type="button" className="btn" disabled={trocandoLogo} onClick={abrirSeletor}>
                {trocandoLogo
                  ? traduzir("Salvando…")
                  : logo
                    ? traduzir("Trocar logotipo")
                    : traduzir("Enviar logotipo")}
              </button>
              {logo ? (
                <button type="button" className="btn ghost" disabled={trocandoLogo} onClick={() => void tirarLogo()}>
                  {traduzir("Tirar logotipo")}
                </button>
              ) : null}
              <input
                ref={entradaDaLogo}
                type="file"
                accept="image/*"
                hidden
                aria-label={traduzir("Arquivo do logotipo")}
                onChange={(e) => {
                  const escolhida = e.target.files?.[0];
                  // Zera antes de usar: sem isso, escolher O MESMO arquivo de novo (depois de um
                  // erro, por exemplo) não dispara `change` nenhum e a tela fica parada.
                  e.target.value = "";
                  void trocarLogo(escolhida);
                }}
              />
            </div>
          ) : null}
        </div>
        <p className="hint">
          {traduzir(
            "É assim que ela aparece no topo do menu, no quadradinho ao lado do nome, no tamanho exato ({largura} × {altura} px). Cabe inteira, sem cortar nem esticar; o símbolo da marca, quadrado e com fundo transparente, fica melhor.",
            { largura: String(LOGO_SLOT.largura), altura: String(LOGO_SLOT.altura) },
          )}
        </p>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Espaço de trabalho")}</p>
        <div className="config-campos">
          <div className="field">
            <label htmlFor="empresa-espaco">{traduzir("Nome do espaço de trabalho")}</label>
            <input
              id="empresa-espaco"
              className="input"
              value={rascunho.nome}
              maxLength={120}
              disabled={!podeEditar}
              onChange={(e) => mexer("nome", e.target.value)}
            />
            <span className="hint">{traduzir("É o nome que aparece no menu, nos convites e nos e-mails.")}</span>
          </div>
        </div>
      </div>

      {podeEditar ? (
        <div className="config-bloco">
          <p className="config-bloco-titulo">{traduzir("Dados da empresa")}</p>
          <div className="config-campos config-grid-2">
            <div className="field">
              <label htmlFor="empresa-razao">{traduzir("Nome da empresa")}</label>
              <input
                id="empresa-razao"
                className="input"
                autoComplete="off"
                placeholder={traduzir("Razão social")}
                value={rascunho.empresaNome}
                maxLength={120}
                onChange={(e) => mexer("empresaNome", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="empresa-fantasia">{traduzir("Nome fantasia")}</label>
              <input
                id="empresa-fantasia"
                className="input"
                autoComplete="off"
                value={rascunho.empresaFantasia}
                maxLength={120}
                onChange={(e) => mexer("empresaFantasia", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="empresa-documento">{traduzir("CNPJ ou CPF")}</label>
              <input
                id="empresa-documento"
                className="input"
                autoComplete="off"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={rascunho.empresaDocumento}
                onChange={(e) => mexer("empresaDocumento", formatarDocumento(e.target.value))}
              />
              <span className="hint">{traduzir("É o mesmo documento da cobrança da assinatura.")}</span>
            </div>
            <div className="field">
              <label htmlFor="empresa-email">{traduzir("E-mail da empresa")}</label>
              <input
                id="empresa-email"
                className="input"
                type="email"
                autoComplete="off"
                placeholder="contato@suaempresa.com.br"
                value={rascunho.empresaEmail}
                maxLength={120}
                onChange={(e) => mexer("empresaEmail", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="empresa-telefone">{traduzir("Telefone")}</label>
              <input
                id="empresa-telefone"
                className="input"
                inputMode="tel"
                autoComplete="off"
                placeholder="(00) 00000-0000"
                value={rascunho.empresaTelefone}
                onChange={(e) => mexer("empresaTelefone", formatarTelefoneDaEmpresa(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="empresa-site">{traduzir("Site")}</label>
              <input
                id="empresa-site"
                className="input"
                inputMode="url"
                autoComplete="off"
                placeholder="suaempresa.com.br"
                value={rascunho.empresaSite}
                maxLength={200}
                onChange={(e) => mexer("empresaSite", e.target.value)}
              />
            </div>
            <div className="field config-campo-largo">
              <label htmlFor="empresa-endereco">{traduzir("Endereço")}</label>
              <input
                id="empresa-endereco"
                className="input"
                autoComplete="off"
                placeholder={traduzir("Rua, número, bairro, cidade e estado")}
                value={rascunho.empresaEndereco}
                maxLength={300}
                onChange={(e) => mexer("empresaEndereco", e.target.value)}
              />
            </div>
            <div className="field config-campo-largo">
              <label htmlFor="empresa-fuso">{traduzir("Fuso horário")}</label>
              {/*
                INFORMAÇÃO, não seletor: o CRM inteiro roda no horário de Brasília (agenda,
                campanhas, confirmações, relatórios). Um seletor aqui prometeria um fuso que
                nenhuma tela respeitaria.
              */}
              <input id="empresa-fuso" className="input" value="Brasília (GMT-3)" disabled readOnly />
              <span className="hint">
                {traduzir("O CRM usa o horário de Brasília na agenda, nos disparos, nos avisos e nos relatórios.")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="hint">{traduzir("Só quem administra a conta altera os dados da empresa.")}</p>
      )}

      {erro ? (
        <p className="hint" style={{ color: "var(--danger)" }} role="alert">
          {traduzir(erro)}
        </p>
      ) : recado ? (
        <p className="hint" role="status">
          {recado}
        </p>
      ) : null}

      {podeEditar ? (
        <SalvarBar
          dirty={mudou}
          onSalvar={() => void salvar()}
          onDescartar={() => {
            setRascunho(salvo);
            setErro(null);
          }}
          mensagemSalvo={traduzir("Dados da empresa salvos.")}
        />
      ) : null}
    </div>
  );
}
