import Link from "next/link";
import type { Metadata } from "next";

import { convite, workspace } from "@/lib/data";

export const metadata: Metadata = { title: "Seu convite · CRM AZUZ" };

/**
 * O que a pessoa convidada vê. O link já vem identificado, então aqui a marca
 * da clínica aparece — ela mesma cria a senha, ninguém da equipe digita por ela.
 */
export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const primeiroNome = convite.nome.split(" ")[0];

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="mark">a</div>
          <p className="login-title" style={{ marginBottom: 2 }}>
            Bem-vindo, {primeiroNome}
          </p>
          <p className="ws">
            {convite.convidadoPor} te convidou pro CRM da {workspace.name}
          </p>
        </div>

        <div className="lfield">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            defaultValue={convite.email}
            readOnly
          />
        </div>

        <div className="lfield">
          <label htmlFor="senha">Crie sua senha</label>
          <input
            id="senha"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="lfield">
          <label htmlFor="senha2">Confirme sua senha</label>
          <input
            id="senha2"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
          />
        </div>

        <Link className="login-btn" href="/inicio">
          Criar senha e entrar
        </Link>

        <p className="login-foot">
          Papel: {convite.papelPersonalizado} · definido pela{" "}
          {convite.convidadoPor}
          <br />
          <span style={{ opacity: 0.7 }}>Convite {token}</span>
        </p>
      </div>
    </div>
  );
}
