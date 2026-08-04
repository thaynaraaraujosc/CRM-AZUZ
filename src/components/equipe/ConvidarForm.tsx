"use client";

import { useRouter } from "next/navigation";

import { convite } from "@/lib/data";
import { useEquipe } from "@/lib/equipe-context";
import { RadioList, Toggle } from "@/components/ui";

/**
 * Formulário de convite — os dados vêm do mock `convite` (front-end apenas, sem envio real de
 * e-mail), mas o botão final agora fecha o fluxo de verdade: cria o membro no `EquipeContext`
 * (como convite pendente, sem senha) e volta pra /equipe, onde ele já aparece na lista.
 */
export function ConvidarForm() {
  const { convidarMembro } = useEquipe();
  const router = useRouter();

  const papeis = [
    ...convite.papeisPadrao.map((p) => ({
      nome: p.nome,
      descricao: p.descricao,
    })),
    {
      nome: "Papel personalizado",
      descricao:
        "Você cria o nome — as permissões ao lado definem o que ele vê, do zero",
      boxed: true,
    },
  ];

  function enviarConvite() {
    convidarMembro({
      nome: convite.nome,
      email: convite.email,
      papel: convite.papelPersonalizado,
      papelTipo: "custom",
      papelNota: "· personalizado",
      enxerga: "Nenhum módulo de vendas — papel criado do zero",
      permissoes: [],
    });
    router.push("/equipe");
  }

  return (
    <div className="grid rep-grid">
      <div className="card">
        <div className="panel-h">
          <h4>Dados</h4>
        </div>
        <div className="field">
          <label>Nome</label>
          <div className="input">{convite.nome}</div>
        </div>
        <div className="field">
          <label>E-mail (vai ser o login dele)</label>
          <div className="input">{convite.email}</div>
        </div>
        <div className="field">
          <label>Papel</label>
          <RadioList options={papeis} initial="Papel personalizado" bare />
          <div className="input mt14">{convite.papelPersonalizado}</div>
          <button type="button" className="btn ghost block mt14">
            + Criar outro papel
          </button>
        </div>
      </div>

      <div className="card">
        <div className="panel-h">
          <h4>
            Permissões do {convite.papelPersonalizado}, função por função
          </h4>
        </div>
        {convite.permissoes.map((permissao) => (
          <div className="toggle-row" key={permissao}>
            <span className="tl">{permissao}</span>
            <Toggle label={permissao} />
          </div>
        ))}
        <p className="hint">
          Nenhuma permissão de CRM vem ligada num papel novo — você escolhe
          cada uma. Pra um estoquista, talvez nenhuma dessas se aplique; ele
          pode só precisar de um módulo de estoque que ainda não existe no
          roadmap.
        </p>
        <div className="section-foot">
          <button type="button" className="btn primary block" onClick={enviarConvite}>
            Enviar convite pro {convite.papelPersonalizado}
          </button>
        </div>
      </div>
    </div>
  );
}
