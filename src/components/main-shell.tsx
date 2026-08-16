"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Só o Início troca o `.main` branco padrão pelo mesmo fundo marinho quadriculado do login
 * (`.main-inicio`, ver globals.css) — nas demais páginas o `.main` continua branco normal. */
export function MainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const classe = pathname === "/inicio" ? "main main-inicio" : "main";
  return <main className={classe}>{children}</main>;
}
