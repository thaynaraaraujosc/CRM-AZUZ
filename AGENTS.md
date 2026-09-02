<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Referências de design do CRM AZUZ

Fontes que a Thaynara escolheu para guiar a evolução visual do produto. Servem como **referência
de princípios** (hierarquia, espaçamento, densidade, microinterações) — não para copiar telas nem
para importar componentes sem avaliar peso, acessibilidade e encaixe na identidade azul do CRM.

| Fonte | Endereço | Para quê |
|---|---|---|
| 21st.dev | https://21st.dev/ | Catálogo de componentes, templates e temas React. Oferece integração via MCP. |
| Assemble UI | https://www.assembleui.com/ | Componentes e seções prontas para montar interfaces. |
| React Bits | https://www.reactbits.dev/ | Animações, fundos, cards, menus e efeitos de interação. Também oferece MCP. |
| Dribbble | https://dribbble.com/ | Inspiração visual. Termos úteis: `CRM dashboard`, `SaaS dashboard`, `sales pipeline`, `inbox UI`, `dark SaaS`. |

Contraste de cor: usar o **Color Contrast Checker** do Figma. (Havia uma quarta ferramenta chamada
"Color" que não foi identificada com segurança — se aparecer o endereço certo, é só acrescentar aqui.)

## Como usar isto sem estragar o que existe

- A identidade é **azul, com tema claro e escuro**. Referência externa entra para amadurecer essa
  identidade, nunca para substituí-la por outra.
- O produto evita glow, neon, gradiente pesado, vidro em tudo e arredondamento exagerado. A
  sensação de produto caro vem de proporção, tipografia, espaçamento e consistência.
- Componente copiado de fora precisa passar pelos tokens do `globals.css` antes de entrar — caso
  contrário o CRM volta a ter várias linguagens visuais convivendo, que foi o problema que a
  unificação do renderizador de mensagens acabou de resolver.
