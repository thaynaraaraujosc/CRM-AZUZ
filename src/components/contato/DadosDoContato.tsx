"use client";

import { useEffect, useState } from "react";

import { CamposPersonalizados } from "@/components/conversas/CamposPersonalizados";
import { IconCheck, IconClose } from "@/components/icons";
import { nomeAindaEhIdCru, nomeExibido } from "@/lib/conversas/exibicao";
import {
  lerCamposDoContato,
  lerValoresDeCampos,
  type CampoDoContato,
  type ValoresDeCampos,
} from "@/lib/contatos/campos-do-contato";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useIdioma } from "@/lib/idioma-context";
import type { Canal } from "@/lib/data";

/**
 * OS DADOS DO CONTATO — UM SÓ, pra tela do WhatsApp e pra do funil.
 *
 * Eram duas. A do WhatsApp tinha treze campos, os campos que a empresa cria, etiquetas e a caixa
 * pra dar nome a um número; a do funil tinha quatro campos e um botão de salvar. Mesmo contato,
 * mesma tabela, telas diferentes — então preencher "cargo" numa e abrir a outra dava a impressão
 * de que o CRM tinha perdido o dado. Não tinha: ele só não era mostrado ali.
 *
 * Duas telas pro mesmo registro é uma promessa que não se cumpre: toda vez que uma ganha um campo,
 * alguém precisa lembrar da outra, e um mês depois elas divergem de novo. Agora é um componente,
 * usado nos dois lugares. O que mudar aqui muda nos dois, por construção, não por disciplina.
 *
 * ELE SE VIRA SOZINHO: recebe o nome da conversa e o canal, e vai buscar o resto (a agenda, os
 * campos da empresa) nos contextos. É o que permite as duas telas usarem-no com uma linha.
 *
 * A TROCA DE CONTATO é resolvida com `key={nome}` em quem o usa: remontar zera o rascunho de
 * edição de uma vez, sem uma lista de `setX(contato?.y ?? "")` que envelhece a cada campo novo.
 */
export function DadosDoContato({
  nome,
  canal,
  aoRegistrarNoHistorico,
}: {
  /** O nome da conversa aberta. É por ele que o contato é encontrado na agenda. */
  nome: string;
  canal?: string | null;
  /** Anota o que aconteceu na linha do tempo da tela que hospeda o painel. Opcional: o funil
   *  ainda não tem uma. */
  aoRegistrarNoHistorico?: (texto: string) => void;
}) {
  const { t: traduzir } = useIdioma();
  const {
    contatos,
    salvarDadosContato,
    adicionarEtiqueta,
    removerEtiqueta,
    recarregar: recarregarContatos,
  } = useContatos();
  const { recarregar: recarregarConversas } = useConversas();

  const contato = contatos.find((c) => c.nome === nome) ?? null;

  const [emailContato, setEmailContato] = useState(contato?.email ?? "");
  const [whatsappContato, setWhatsappContato] = useState(contato?.whatsapp ?? "");
  const [nascimentoContato, setNascimentoContato] = useState(contato?.nascimento ?? "");
  const [enderecoContato, setEnderecoContato] = useState(contato?.endereco ?? "");
  const [sobrenomeContato, setSobrenomeContato] = useState(contato?.sobrenome ?? "");
  const [empresaContato, setEmpresaContato] = useState(contato?.empresa ?? "");
  const [cargoContato, setCargoContato] = useState(contato?.cargo ?? "");
  const [cidadeContato, setCidadeContato] = useState(contato?.cidade ?? "");
  const [estadoContato, setEstadoContato] = useState(contato?.estado ?? "");
  const [paisContato, setPaisContato] = useState(contato?.pais ?? "");
  const [canalPreferidoContato, setCanalPreferidoContato] = useState<Canal>(
    contato?.canalPreferido ?? ((canal as Canal) || "WhatsApp"),
  );
  const [melhorHorarioContato, setMelhorHorarioContato] = useState(contato?.melhorHorario ?? "");
  const [editandoContato, setEditandoContato] = useState(false);
  const [statusSalvarContato, setStatusSalvarContato] = useState<
    "ocioso" | "salvando" | "sucesso" | "erro"
  >("ocioso");
  const [novaEtiquetaTexto, setNovaEtiquetaTexto] = useState("");

  /*
   * OS CAMPOS QUE A EMPRESA CRIOU: a DEFINIÇÃO é do workspace, o VALOR é deste contato.
   *
   * A lista é buscada uma vez e serve a qualquer contato; os valores vêm do contato aberto.
   */
  const [camposDoContato, setCamposDoContato] = useState<CampoDoContato[]>([]);
  const [salvandoCamposDefs, setSalvandoCamposDefs] = useState(false);
  const [valoresCampos, setValoresCampos] = useState<ValoresDeCampos>({});
  const [origemDosValoresDeCampos, setOrigemDosValoresDeCampos] = useState("");

  const [nomeParaONumero, setNomeParaONumero] = useState("");
  const [statusNomearNumero, setStatusNomearNumero] = useState<"ocioso" | "salvando" | "erro">(
    "ocioso",
  );
  const [erroNomearNumero, setErroNomearNumero] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/contatos/campos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => {
        if (vivo) setCamposDoContato(lerCamposDoContato(dados));
      })
      .catch(() => {
        /* Sem campos personalizados o painel segue inteiro: só mostra os fixos. */
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
   * OS VALORES SEGUEM O CONTATO — menos enquanto alguém está digitando.
   *
   * Duas coisas trazem valor novo: a lista de campos terminar de carregar (ela chega depois da
   * primeira pintura) e o contato ser salvo. Uma CHAVE junta as duas, e o ajuste é feito durante
   * a renderização — que é o padrão do React pra estado derivado de prop, e evita o render a mais
   * que um `useEffect` com `setState` custaria.
   *
   * A guarda do modo de edição impede o caso feio: a agenda se atualizar no meio do
   * preenchimento e apagar o que a pessoa acabou de escrever.
   */
  const chaveDosValoresDeCampos = `${JSON.stringify(contato?.camposExtras ?? {})}|${camposDoContato
    .map((c) => c.id)
    .join(",")}`;
  if (!editandoContato && chaveDosValoresDeCampos !== origemDosValoresDeCampos) {
    setOrigemDosValoresDeCampos(chaveDosValoresDeCampos);
    setValoresCampos(lerValoresDeCampos(contato?.camposExtras, camposDoContato));
  }

  function emailValido(valor: string) {
    return valor.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  async function salvarDados() {
    if (!emailValido(emailContato)) {
      setStatusSalvarContato("erro");
      return;
    }
    setStatusSalvarContato("salvando");
    try {
      // `salvarDadosContato` já persiste de verdade (ver contatos-context.tsx): a espera aqui é só
      // pra dar a sensação de salvamento antes de o formulário fechar.
      await new Promise((resolve) => setTimeout(resolve, 450));
      salvarDadosContato(nome, {
        email: emailContato.trim() || undefined,
        whatsapp: whatsappContato.trim() || undefined,
        nascimento: nascimentoContato.trim() || undefined,
        endereco: enderecoContato.trim() || undefined,
        sobrenome: sobrenomeContato.trim() || undefined,
        empresa: empresaContato.trim() || undefined,
        cargo: cargoContato.trim() || undefined,
        cidade: cidadeContato.trim() || undefined,
        estado: estadoContato.trim() || undefined,
        pais: paisContato.trim() || undefined,
        canalPreferido: canalPreferidoContato,
        melhorHorario: melhorHorarioContato.trim() || undefined,
        /*
         * Vai SEMPRE, mesmo vazio — ao contrário dos de cima, que viram `undefined` e são
         * ignorados pelo servidor. É que aqui esvaziar um campo tem significado: "apaga o que
         * estava ali". Com `undefined` o valor antigo ficaria gravado e voltaria na tela.
         */
        camposExtras: lerValoresDeCampos(valoresCampos, camposDoContato),
      });
      aoRegistrarNoHistorico?.("Dados do contato atualizados");
      setStatusSalvarContato("sucesso");
      setEditandoContato(false);
      setTimeout(() => setStatusSalvarContato("ocioso"), 2500);
    } catch {
      setStatusSalvarContato("erro");
    }
  }

  function cancelarEdicaoContato() {
    setEmailContato(contato?.email ?? "");
    setWhatsappContato(contato?.whatsapp ?? "");
    setNascimentoContato(contato?.nascimento ?? "");
    setEnderecoContato(contato?.endereco ?? "");
    setSobrenomeContato(contato?.sobrenome ?? "");
    setEmpresaContato(contato?.empresa ?? "");
    setCargoContato(contato?.cargo ?? "");
    setCidadeContato(contato?.cidade ?? "");
    setEstadoContato(contato?.estado ?? "");
    setPaisContato(contato?.pais ?? "");
    setCanalPreferidoContato(contato?.canalPreferido ?? ((canal as Canal) || "WhatsApp"));
    setMelhorHorarioContato(contato?.melhorHorario ?? "");
    setValoresCampos(lerValoresDeCampos(contato?.camposExtras, camposDoContato));
    setStatusSalvarContato("ocioso");
    setEditandoContato(false);
  }

  /**
   * Grava a lista de campos do workspace (criar e apagar passam os dois por aqui).
   *
   * A tela muda na hora e a requisição vai junto: a lista é curta e a operação é rara. Se falhar,
   * a lista volta ao que o servidor respondeu — é melhor ver o campo sumir do que achar que criou
   * e descobrir amanhã que não.
   */
  function salvarDefinicoesDeCampos(novos: CampoDoContato[]) {
    const anteriores = camposDoContato;
    setCamposDoContato(novos);
    setSalvandoCamposDefs(true);
    fetch("/api/contatos/campos", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(novos),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setCamposDoContato(lerCamposDoContato(await r.json()));
      })
      .catch(() => setCamposDoContato(anteriores))
      .finally(() => setSalvandoCamposDefs(false));
  }

  function adicionarEtiquetaRapida() {
    const etiqueta = novaEtiquetaTexto.trim();
    if (!etiqueta) return;
    adicionarEtiqueta(nome, etiqueta);
    aoRegistrarNoHistorico?.(`Etiqueta "${etiqueta}" adicionada`);
    setNovaEtiquetaTexto("");
  }

  function removerEtiquetaRapida(etiqueta: string) {
    removerEtiqueta(nome, etiqueta);
    aoRegistrarNoHistorico?.(`Etiqueta "${etiqueta}" removida`);
  }

  /**
   * Dá nome a um número que ainda não tem.
   *
   * A rota só aceita conversa cujo nome ainda é identificador cru, e por baixo é a mesma
   * transação que o webhook usa quando o @ do Instagram resolve depois: mensagens, card do funil,
   * contato e conversa mudam juntos ou não mudam.
   */
  async function nomearONumero() {
    const novo = nomeParaONumero.trim().replace(/\s+/g, " ");
    if (novo.length < 2) return;
    setStatusNomearNumero("salvando");
    setErroNomearNumero("");
    try {
      const resposta = await fetch("/api/conversas/renomear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ de: nome, para: novo }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu pra salvar o nome.");
      recarregarConversas();
      recarregarContatos();
      aoRegistrarNoHistorico?.(`Número salvo como ${novo}`);
      setNomeParaONumero("");
      setStatusNomearNumero("ocioso");
    } catch (erro) {
      setErroNomearNumero(erro instanceof Error ? erro.message : "Não deu pra salvar o nome.");
      setStatusNomearNumero("erro");
    }
  }

  return (
    <>
      <div className="panel-h">
        <h4>{traduzir("Dados do contato")}</h4>
        {!editandoContato ? (
          <button
            type="button"
            className="link"
            onClick={() => setEditandoContato(true)}
          >
            {traduzir("Editar")}
          </button>
        ) : null}
      </div>

      {/*
        O NOME, E A CAIXA PRA DAR UM quando ainda não há.
        
        Conversa de número desconhecido nasce com o telefone no lugar do nome. Quem
        atende descobre o nome na terceira linha da conversa e não tinha onde escrevê-lo:
        o painel mostrava o número e acabava ali. Agora escreve, salva, e o CRM inteiro
        passa a chamar a pessoa pelo nome — conversa, contato e card do funil.
        
        Pra quem JÁ TEM nome o campo continua só leitura: trocar o nome de um contato
        existente mexeria em automação e filtro salvos que apontam pra ele. Isso é outra
        operação, e ninguém pediu por ela.
      */}
      {nomeAindaEhIdCru(nome) ? (
        <div className="field">
          <label>{traduzir("Nome")}</label>
          <p className="wa-sem-nome">
            {traduzir("Este número ainda não tem nome salvo.")}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              value={nomeParaONumero}
              maxLength={80}
              placeholder={traduzir("Nome de quem está falando")}
              onChange={(e) => setNomeParaONumero(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nomearONumero()}
            />
            <button
              type="button"
              className="btn primary"
              onClick={nomearONumero}
              disabled={
                statusNomearNumero === "salvando" || nomeParaONumero.trim().length < 2
              }
            >
              {statusNomearNumero === "salvando" ? traduzir("Salvando…") : traduzir("Salvar")}
            </button>
          </div>
          <span className="hint">{nomeExibido(nome, canal)}</span>
          {erroNomearNumero ? (
            <span className="wa-campo-erro">{erroNomearNumero}</span>
          ) : null}
        </div>
      ) : (
        <div className="field">
          <label>{traduzir("Nome")}</label>
          <div className="input">{nome}</div>
        </div>
      )}
      <div className="field">
        <label>{traduzir("Sobrenome")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={sobrenomeContato}
            onChange={(e) => setSobrenomeContato(e.target.value)}
            placeholder={traduzir("Sobrenome do contato")}
          />
        ) : (
          <div className="input">{sobrenomeContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("E-mail")}</label>
        {editandoContato ? (
          <input
            className={`input${!emailValido(emailContato) ? " wa-input-invalido" : ""}`}
            style={{ width: "100%" }}
            type="email"
            value={emailContato}
            onChange={(e) => setEmailContato(e.target.value)}
            placeholder="nome@empresa.com"
          />
        ) : (
          <div className="input">{emailContato || "Não informado"}</div>
        )}
        {editandoContato && !emailValido(emailContato) ? (
          <span className="wa-campo-erro">{traduzir("E-mail inválido")}</span>
        ) : null}
      </div>
      <div className="field">
        <label>WhatsApp</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            type="text"
            value={whatsappContato}
            onChange={(e) => setWhatsappContato(e.target.value)}
            placeholder="(00) 90000-0000"
          />
        ) : (
          <div className="input">{whatsappContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Empresa")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={empresaContato}
            onChange={(e) => setEmpresaContato(e.target.value)}
            placeholder={traduzir("Nome da empresa (opcional pra B2C)")}
          />
        ) : (
          <div className="input">{empresaContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Cargo")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={cargoContato}
            onChange={(e) => setCargoContato(e.target.value)}
            placeholder={traduzir("Cargo na empresa")}
          />
        ) : (
          <div className="input">{cargoContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Aniversário")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={nascimentoContato}
            onChange={(e) => setNascimentoContato(e.target.value)}
            placeholder="DD/MM/AAAA"
          />
        ) : (
          <div className="input">{nascimentoContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Endereço")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={enderecoContato}
            onChange={(e) => setEnderecoContato(e.target.value)}
            placeholder={traduzir("Rua, número, bairro")}
          />
        ) : (
          <div className="input">{enderecoContato || "Não informado"}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Cidade / Estado / País")}</label>
        {editandoContato ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ flex: 2 }}
              value={cidadeContato}
              onChange={(e) => setCidadeContato(e.target.value)}
              placeholder={traduzir("Cidade")}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              value={estadoContato}
              onChange={(e) => setEstadoContato(e.target.value)}
              placeholder="UF"
            />
            <input
              className="input"
              style={{ flex: 2 }}
              value={paisContato}
              onChange={(e) => setPaisContato(e.target.value)}
              placeholder={traduzir("País")}
            />
          </div>
        ) : (
          <div className="input">
            {[cidadeContato, estadoContato, paisContato].filter(Boolean).join(" · ") ||
              "Não informado"}
          </div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Canal preferido")}</label>
        {editandoContato ? (
          <select
            className="input"
            style={{ width: "100%", cursor: "pointer" }}
            value={canalPreferidoContato}
            onChange={(e) => setCanalPreferidoContato(e.target.value as Canal)}
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
          </select>
        ) : (
          <div className="input">{canalPreferidoContato}</div>
        )}
      </div>
      <div className="field">
        <label>{traduzir("Melhor horário pra contato")}</label>
        {editandoContato ? (
          <input
            className="input"
            style={{ width: "100%" }}
            value={melhorHorarioContato}
            onChange={(e) => setMelhorHorarioContato(e.target.value)}
            placeholder={traduzir("Ex.: Tardes, depois das 14h")}
          />
        ) : (
          <div className="input">{melhorHorarioContato || "Não informado"}</div>
        )}
      </div>

      {/*
        OS CAMPOS QUE A PRÓPRIA EMPRESA CRIOU.
        
        Vêm depois dos fixos e antes das etiquetas de propósito: os de cima são os que
        todo CRM tem, estes são os desta empresa, e etiqueta é outra coisa (marcação
        solta, não campo com valor). Ver `CamposPersonalizados.tsx`.
      */}
      <CamposPersonalizados
        campos={camposDoContato}
        valores={valoresCampos}
        editando={editandoContato}
        salvandoDefinicoes={salvandoCamposDefs}
        onMudarValor={(id, valor) =>
          setValoresCampos((prev) => ({ ...prev, [id]: valor }))
        }
        onSalvarDefinicoes={salvarDefinicoesDeCampos}
      />

      <div className="field">
        <label>{traduzir("Etiquetas")}</label>
        <div className="wa-etiquetas-lista">
          {(contato?.etiquetas ?? []).length === 0 ? (
            <span className="hint">{traduzir("Nenhuma etiqueta ainda.")}</span>
          ) : (
            (contato?.etiquetas ?? []).map((et) => (
              <span className="wa-etiqueta-chip" key={et}>
                {et}
                <button
                  type="button"
                  aria-label={`Remover etiqueta ${et}`}
                  onClick={() => removerEtiquetaRapida(et)}
                >
                  <IconClose width={10} height={10} />
                </button>
              </span>
            ))
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder={traduzir("Nova etiqueta…")}
            value={novaEtiquetaTexto}
            onChange={(e) => setNovaEtiquetaTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarEtiquetaRapida()}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={adicionarEtiquetaRapida}
            disabled={!novaEtiquetaTexto.trim()}
          >
            + Adicionar
          </button>
        </div>
      </div>

      {editandoContato ? (
        <div className="section-foot">
          <button
            type="button"
            className="btn ghost"
            style={{ flex: 1 }}
            onClick={cancelarEdicaoContato}
          >
            {traduzir("Cancelar")}
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            onClick={salvarDados}
            disabled={statusSalvarContato === "salvando" || !emailValido(emailContato)}
          >
            {statusSalvarContato === "salvando" ? "Salvando…" : "Salvar"}
          </button>
        </div>
      ) : null}
      {statusSalvarContato === "sucesso" ? (
        <p className="wa-status-inline wa-status-sucesso" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconCheck width={13} height={13} /> {traduzir("Dados salvos")}
        </p>
      ) : statusSalvarContato === "erro" ? (
        <p className="wa-status-inline wa-status-erro" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconClose width={13} height={13} /> {traduzir("Não deu pra salvar: confira o e-mail")}
        </p>
      ) : null}
    </>
  );
}
