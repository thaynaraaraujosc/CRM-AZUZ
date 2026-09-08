# Marca

Arquivos originais enviados pela Thaynara. Ficam aqui, e não em `src/app/`, porque tudo dentro de
`src/app` é rota: uma imagem solta ali confunde a leitura da estrutura, e nomes como `icon` e
`opengraph-image` têm significado especial pro Next justamente nessa pasta.

| Arquivo | O que é |
|---|---|
| `logo-azuz.jpg` | O "a" branco sobre o azul da marca. É a fonte do ícone do site. |
| `logo-azuz-esfera.jpg` | A esfera com gradiente. Bonita em tamanho grande, ilegível a 16px. |

O azul da marca, medido no pixel do canto do arquivo original: **#2f6bff**. Praticamente o mesmo
`--blue: #2e6bff` que o CRM já usava como azul vibrante, o que confirma que a interface e a marca
falam a mesma língua.

## Como os ícones foram gerados

`src/app/icon.png` (512x512) e `src/app/apple-icon.png` (180x180) saíram de `logo-azuz.jpg`. O
original está em retrato (1501x1875), com sobra de azul em cima e embaixo: usá-lo direto faria o
navegador achatar ou cortar torto. O processo foi recortar o desenho branco (`trim`), medir a marca
sozinha (483x540) e recompô-la centrada num quadrado do azul da marca, ocupando 56% do lado.

Pra refazer depois de trocar a logo, é o mesmo caminho: recortar o fundo chapado, medir e recompor
centrado. O que não funciona é redimensionar o arquivo original direto, porque o centro do arquivo
não é o centro da marca.

## O favicon.ico

`src/app/favicon.ico` também vem de `logo-azuz.jpg`, pelo mesmo processo, em 64x64.

Ele existe porque `icon.png` sozinho não basta: navegadores antigos e alguns leitores de link pedem
`/favicon.ico` direto no domínio, sem ler o HTML. Sem o arquivo, esse pedido dá 404 e cada um
resolve do seu jeito, geralmente mostrando o ícone que tinham guardado antes.

O arquivo é um ICO com um PNG embutido (formato aceito desde o Windows Vista): 6 bytes de
cabeçalho, 16 de descrição da imagem e o PNG em seguida. Foi montado à mão porque as bibliotecas de
imagem do projeto não escrevem ICO. O código está no histórico deste commit.
