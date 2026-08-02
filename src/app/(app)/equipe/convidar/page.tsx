import Link from "next/link";
import type { Metadata } from "next";

import { convite } from "@/lib/data";
import { RadioList, Toggle, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Convidar membro · CRM AZUZ" };

export default function ConvidarPage() {
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

  return (
    <>
      <Topbar
        title="Convidar membro"
        sub="A pessoa recebe um e-mail e cria a própria senha — vocês nunca digitam a senha de ninguém"
        actions={
          <Link className="btn ghost" href="/equipe">
            ← Voltar pra equipe
          </Link>
        }
      />

      <div className="content">
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
              <RadioList
                options={papeis}
                initial="Papel personalizado"
                bare
              />
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
              <Link className="btn primary block" href="/equipe">
                Enviar convite pro {convite.papelPersonalizado}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
