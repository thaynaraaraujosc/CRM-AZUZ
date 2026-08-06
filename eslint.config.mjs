import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // whatsapp-worker/ é um projeto Node separado (deploy próprio no Railway), não faz parte do
    // app Next.js — tem seu próprio tsc, sem regras de React (o linter daqui confundia
    // `useMultiFileAuthState` do Baileys com um Hook do React por causa do prefixo "use").
    "whatsapp-worker/**",
  ]),
]);

export default eslintConfig;
