import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança.
 *
 * Não havia nenhum. São defesas que o navegador aplica sozinho — custo zero em runtime e cobrem
 * classes inteiras de ataque que nenhuma validação de servidor alcança (clickjacking, sniffing de
 * tipo, vazamento de endereço interno pelo `Referer`).
 *
 * A Content-Security-Policy foi montada a partir do que o CRM REALMENTE usa hoje, não de um modelo
 * pronto: imagem e mídia vêm do CDN da Meta e do R2; a Meta injeta script no fluxo do Embedded
 * Signup; o mapa da localização vem do OpenStreetMap. Uma CSP copiada de outro projeto quebraria
 * essas integrações em silêncio — e um recurso bloqueado por CSP não gera erro visível, só some.
 *
 * Por isso ela vai em modo RELATO primeiro (`Report-Only`): o navegador registra o que teria sido
 * bloqueado sem bloquear nada. Depois de conferir que nenhuma integração aparece nos relatos, é
 * trocar o nome do cabeçalho para o modo que bloqueia de verdade. Ligar direto arriscaria derrubar
 * o login do WhatsApp de um cliente sem ninguém entender por quê.
 */
const CSP = [
  "default-src 'self'",
  // `unsafe-inline`/`unsafe-eval` são exigências do runtime do Next; retirá-las depende de nonce
  // por requisição, que é um passo à parte.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://graph.facebook.com https://graph.instagram.com",
  "frame-src 'self' https://www.facebook.com https://web.facebook.com",
  // Ninguém pode embutir o CRM num iframe — é o que impede clickjacking (uma página falsa por cima
  // capturando cliques reais).
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Pra onde o navegador manda o que teria sido bloqueado. Sem isto o modo relato é cego.
  "report-uri /api/seguranca/csp",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          // O navegador para de "adivinhar" o tipo do arquivo. Sem isso, um anexo enviado por um
          // cliente pode ser interpretado como HTML e executar script no domínio do CRM.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Endereço interno do CRM não vaza pra sites externos quando alguém clica num link.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Câmera e microfone continuam liberados (o CRM grava áudio); o resto é desligado.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
          // HSTS: o navegador passa a recusar HTTP nesse domínio. Só faz sentido em produção, onde
          // o HTTPS já está garantido pela hospedagem.
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
