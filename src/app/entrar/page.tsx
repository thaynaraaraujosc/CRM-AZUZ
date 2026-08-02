import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar · CRM AZUZ" };

export default function EntrarPage() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="mark">a</div>
          <p className="login-title" style={{ marginBottom: 2 }}>
            AZUZ CRM
          </p>
          <p className="ws">Entrar na sua conta</p>
        </div>

        <div className="lfield">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            placeholder="secretaria@clinicavitta.com.br"
          />
        </div>

        <div className="lfield">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
          />
        </div>

        <div className="login-row">
          <label className="rem" htmlFor="manter">
            <input
              id="manter"
              type="checkbox"
              style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
            />
            <span className="chk" aria-hidden />
            Manter conectado
          </label>
          <Link href="/entrar">Esqueci minha senha</Link>
        </div>

        <Link className="login-btn" href="/inicio">
          Entrar
        </Link>

        <p className="login-foot">
          Sem marca de clínica nenhuma aqui — o sistema só sabe qual workspace é
          seu depois que você entra com seu e-mail e senha. Quem chega por
          convite já vê o nome da própria clínica, porque o link já vem
          identificado.
        </p>
      </div>
    </div>
  );
}
